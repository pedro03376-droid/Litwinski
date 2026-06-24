import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import {
  PerformanceIndex,
  PerformanceClassification,
  PerformanceSource,
} from './entities/performance-index.entity';

// ─── Query-builder chain mock ────────────────────────────────────────────────

const mockQb = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(0),
  getMany: jest.fn().mockResolvedValue([]),
  getRawMany: jest.fn().mockResolvedValue([]),
};

const mockRepo = {
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'uuid-1', ...entity }),
  ),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  merge: jest.fn().mockImplementation((target, source) =>
    Object.assign(target, source),
  ),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

// ─── Fixture data ─────────────────────────────────────────────────────────────

/** Scout data that produces a solid performance (overall ~7+) */
const goodScoutInput = {
  goalkeeperId: 'gk-1',
  matchId: 'match-1',
  season: '2024',
  highSaveRight: 5,
  highSaveLeft: 3,
  lowSaveRight: 2,
  lowSaveLeft: 2,
  centralSave: 1,
  interceptions: 6,
  clearances: 3,
  launchRightFoot: 4,
  launchLeftFoot: 1,
  launchRightHand: 2,
  positionBaseLeft: 8,
  positionBaseRight: 8,
  goalOutsideArea: 0,
  goalInsideArea: 1,
};

/** Scout data that produces a poor performance (many goals, few saves) */
const badScoutInput = {
  goalkeeperId: 'gk-2',
  matchId: 'match-2',
  highSaveRight: 0,
  highSaveLeft: 0,
  lowSaveRight: 1,
  lowSaveLeft: 0,
  centralSave: 0,
  interceptions: 0,
  clearances: 0,
  launchRightFoot: 0,
  launchLeftFoot: 1,
  launchRightHand: 0,
  positionBaseLeft: 0,
  positionBaseRight: 0,
  goalOutsideArea: 2,
  goalInsideArea: 6,
};

/** Good training exercises: high success rate, fast reaction */
const goodExercises = [
  { category: 'reflex', attempts: 10, successes: 9, reactionTimeSeconds: 0.3 },
  { category: 'positioning', attempts: 10, successes: 8, reactionTimeSeconds: 0.32 },
];

/** Poor training exercises: low success rate, slow reaction */
const poorExercises = [
  { category: 'reflex', attempts: 10, successes: 3, reactionTimeSeconds: 1.2 },
  { category: 'positioning', attempts: 10, successes: 2, reactionTimeSeconds: 1.5 },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PerformanceService', () => {
  let service: PerformanceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset QB chain defaults after clearAllMocks
    mockQb.select.mockReturnThis();
    mockQb.addSelect.mockReturnThis();
    mockQb.where.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.groupBy.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQb.innerJoin.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.getCount.mockResolvedValue(0);
    mockQb.getMany.mockResolvedValue([]);
    mockQb.getRawMany.mockResolvedValue([]);

    mockRepo.create.mockImplementation((dto) => dto);
    mockRepo.save.mockImplementation((entity) =>
      Promise.resolve({ id: 'uuid-1', ...entity }),
    );
    mockRepo.find.mockResolvedValue([]);
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.merge.mockImplementation((target: any, source: any) =>
      Object.assign(target, source),
    );
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        {
          provide: getRepositoryToken(PerformanceIndex),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
  });

  // ─── calculateFromMatch ────────────────────────────────────────────────────

  describe('calculateFromMatch', () => {
    it('should return overallScore >= 6 when goalkeeper has many saves and few goals', async () => {
      const result = await service.calculateFromMatch('match-1', goodScoutInput);

      expect(result.overallScore).toBeGreaterThanOrEqual(6);
    });

    it('should return highSaveScore > 5 when highSaveRight + highSaveLeft is above half of MAX_HIGH_SAVES', async () => {
      const result = await service.calculateFromMatch('match-1', goodScoutInput);

      // highSaveRight=5, highSaveLeft=3 → (8/10)*10 = 8.0
      expect(result.highSaveScore).toBeGreaterThan(5);
    });

    it('should return overallScore lower than good input when save rate is poor', async () => {
      const good = await service.calculateFromMatch('match-1', goodScoutInput);
      const bad = await service.calculateFromMatch('match-2', badScoutInput);

      expect(bad.overallScore).toBeLessThan(good.overallScore);
    });

    it('should set source to PerformanceSource.MATCH on the created entity', async () => {
      await service.calculateFromMatch('match-1', goodScoutInput);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: PerformanceSource.MATCH,
          goalkeeperId: 'gk-1',
          matchId: 'match-1',
        }),
      );
    });

    it('should persist the entity via repo.save and return it with an id', async () => {
      const result = await service.calculateFromMatch('match-1', goodScoutInput);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('uuid-1');
    });

    it('should classify the result based on overall score', async () => {
      const result = await service.calculateFromMatch('match-1', goodScoutInput);

      const validClassifications = Object.values(PerformanceClassification);
      expect(validClassifications).toContain(result.classification);
    });

    it('should throw BadRequestException when goalkeeperId is missing', async () => {
      const { goalkeeperId: _omitted, ...inputWithoutGk } = goodScoutInput;

      await expect(
        service.calculateFromMatch('match-1', inputWithoutGk),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update an existing record when matchId already exists in the repository', async () => {
      const existing: Partial<PerformanceIndex> = {
        id: 'existing-uuid',
        matchId: 'match-1',
        overallScore: 5,
      };
      mockRepo.findOne.mockResolvedValueOnce(existing);

      await service.calculateFromMatch('match-1', goodScoutInput);

      // merge + save should be called; create should NOT be called for upsert path
      expect(mockRepo.merge).toHaveBeenCalledWith(existing, expect.any(Object));
      expect(mockRepo.save).toHaveBeenCalledWith(existing);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should return overallScore between 0 and 10 for any valid input', async () => {
      const result = await service.calculateFromMatch('match-1', goodScoutInput);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(10);
    });

    it('should set goalExitScore to 10 when no goals are conceded outside the area', async () => {
      // goodScoutInput has goalOutsideArea=0
      const result = await service.calculateFromMatch('match-1', goodScoutInput);

      expect(result.goalExitScore).toBe(10);
    });

    it('should reduce goalExitScore when goals are conceded outside the area', async () => {
      // badScoutInput has goalOutsideArea=2 → 10 - 2*2 = 6
      const result = await service.calculateFromMatch('match-2', badScoutInput);

      expect(result.goalExitScore).toBeLessThan(10);
    });
  });

  // ─── calculateFromTraining ─────────────────────────────────────────────────

  describe('calculateFromTraining', () => {
    it('should return overallScore >= 7 when success rate is high and reaction time is fast', async () => {
      const result = await service.calculateFromTraining(
        'session-1',
        'gk-1',
        goodExercises,
      );

      expect(result.overallScore).toBeGreaterThanOrEqual(7);
    });

    it('should return overallScore < 5 when success rate is low and reaction time is slow', async () => {
      const result = await service.calculateFromTraining(
        'session-2',
        'gk-2',
        poorExercises,
      );

      expect(result.overallScore).toBeLessThan(5);
    });

    it('should set source to PerformanceSource.TRAINING on the created entity', async () => {
      await service.calculateFromTraining('session-1', 'gk-1', goodExercises);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: PerformanceSource.TRAINING,
          goalkeeperId: 'gk-1',
          trainingSessionId: 'session-1',
        }),
      );
    });

    it('should persist the entity and return it with an id', async () => {
      const result = await service.calculateFromTraining(
        'session-1',
        'gk-1',
        goodExercises,
      );

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('uuid-1');
    });

    it('should return overallScore = 0 and classification DEVELOPING when exercises list is empty', async () => {
      const result = await service.calculateFromTraining(
        'session-empty',
        'gk-1',
        [],
      );

      expect(result.overallScore).toBe(0);
      expect(result.classification).toBe(PerformanceClassification.DEVELOPING);
    });

    it('should update existing record when trainingSessionId already exists', async () => {
      const existing: Partial<PerformanceIndex> = {
        id: 'existing-uuid',
        trainingSessionId: 'session-1',
        overallScore: 3,
      };
      mockRepo.findOne.mockResolvedValueOnce(existing);

      await service.calculateFromTraining('session-1', 'gk-1', goodExercises);

      expect(mockRepo.merge).toHaveBeenCalledWith(existing, expect.any(Object));
      expect(mockRepo.save).toHaveBeenCalledWith(existing);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should return overallScore between 0 and 10', async () => {
      const result = await service.calculateFromTraining(
        'session-1',
        'gk-1',
        goodExercises,
      );

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(10);
    });

    it('should forward optional date and season to the created entity', async () => {
      const date = new Date('2024-06-01');

      await service.calculateFromTraining(
        'session-1',
        'gk-1',
        goodExercises,
        date,
        '2024',
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ date, season: '2024' }),
      );
    });
  });

  // ─── findByGoalkeeper ──────────────────────────────────────────────────────

  describe('findByGoalkeeper', () => {
    it('should build a query filtered by goalkeeperId and ordered by date DESC', async () => {
      mockQb.getCount.mockResolvedValueOnce(0);
      mockQb.getMany.mockResolvedValueOnce([]);

      await service.findByGoalkeeper('gk-42');

      expect(mockQb.where).toHaveBeenCalledWith(
        'perf.goalkeeperId = :goalkeeperId',
        { goalkeeperId: 'gk-42' },
      );
      expect(mockQb.orderBy).toHaveBeenCalledWith('perf.date', 'DESC');
    });

    it('should return correct pagination shape with total, page, limit, and totalPages', async () => {
      mockQb.getCount.mockResolvedValueOnce(45);
      mockQb.getMany.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }] as PerformanceIndex[]);

      const result = await service.findByGoalkeeper(
        'gk-42',
        {},
        { page: 2, limit: 20 },
      );

      expect(result.total).toBe(45);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
      expect(result.data).toHaveLength(2);
    });

    it('should use defaults of page=1 and limit=20 when not provided', async () => {
      await service.findByGoalkeeper('gk-42');

      expect(mockQb.skip).toHaveBeenCalledWith(0); // (1-1)*20
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });

    it('should apply source filter when provided', async () => {
      await service.findByGoalkeeper(
        'gk-42',
        { source: PerformanceSource.MATCH },
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'perf.source = :source',
        { source: PerformanceSource.MATCH },
      );
    });

    it('should apply season filter when provided', async () => {
      await service.findByGoalkeeper('gk-42', { season: '2024' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'perf.season = :season',
        { season: '2024' },
      );
    });

    it('should apply dateFrom filter when provided', async () => {
      await service.findByGoalkeeper('gk-42', { dateFrom: '2024-01-01' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'perf.date >= :dateFrom',
        { dateFrom: '2024-01-01' },
      );
    });

    it('should apply dateTo filter when provided', async () => {
      await service.findByGoalkeeper('gk-42', { dateTo: '2024-12-31' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'perf.date <= :dateTo',
        { dateTo: '2024-12-31' },
      );
    });

    it('should throw BadRequestException when page is less than 1', async () => {
      await expect(
        service.findByGoalkeeper('gk-42', {}, { page: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when limit is greater than 100', async () => {
      await expect(
        service.findByGoalkeeper('gk-42', {}, { limit: 101 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getEvolutionChart ─────────────────────────────────────────────────────

  describe('getEvolutionChart', () => {
    it('should return data grouped by month with YYYY-MM keys when period is monthly', async () => {
      const records = [
        {
          date: new Date('2024-03-10'),
          overallScore: 7,
          highSaveScore: 8,
          lowSaveScore: 6,
          interceptionScore: 7,
          distributionScore: 8,
          positioningScore: 7,
        },
        {
          date: new Date('2024-03-25'),
          overallScore: 8,
          highSaveScore: 9,
          lowSaveScore: 7,
          interceptionScore: 8,
          distributionScore: 7,
          positioningScore: 8,
        },
        {
          date: new Date('2024-04-05'),
          overallScore: 6,
          highSaveScore: 6,
          lowSaveScore: 5,
          interceptionScore: 6,
          distributionScore: 6,
          positioningScore: 6,
        },
      ] as PerformanceIndex[];

      mockRepo.find.mockResolvedValueOnce(records);

      const result = await service.getEvolutionChart('gk-1', 'monthly');

      expect(result.period).toBe('monthly');
      expect(result.data).toHaveLength(2); // March and April
      const periods = result.data.map((d) => d.period);
      expect(periods).toContain('2024-03');
      expect(periods).toContain('2024-04');
    });

    it('should average scores within the same period', async () => {
      const records = [
        {
          date: new Date('2024-03-10'),
          overallScore: 6,
          highSaveScore: 6,
          lowSaveScore: 6,
          interceptionScore: 6,
          distributionScore: 6,
          positioningScore: 6,
        },
        {
          date: new Date('2024-03-20'),
          overallScore: 8,
          highSaveScore: 8,
          lowSaveScore: 8,
          interceptionScore: 8,
          distributionScore: 8,
          positioningScore: 8,
        },
      ] as PerformanceIndex[];

      mockRepo.find.mockResolvedValueOnce(records);

      const result = await service.getEvolutionChart('gk-1', 'monthly');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].overallScore).toBe(7); // (6+8)/2
      expect(result.data[0].count).toBe(2);
    });

    it('should group data by year when period is yearly', async () => {
      const records = [
        {
          date: new Date('2023-06-15'),
          overallScore: 7,
          highSaveScore: 7,
          lowSaveScore: 7,
          interceptionScore: 7,
          distributionScore: 7,
          positioningScore: 7,
        },
        {
          date: new Date('2024-02-20'),
          overallScore: 8,
          highSaveScore: 8,
          lowSaveScore: 8,
          interceptionScore: 8,
          distributionScore: 8,
          positioningScore: 8,
        },
      ] as PerformanceIndex[];

      mockRepo.find.mockResolvedValueOnce(records);

      const result = await service.getEvolutionChart('gk-1', 'yearly');

      expect(result.period).toBe('yearly');
      expect(result.data).toHaveLength(2);
      const periods = result.data.map((d) => d.period);
      expect(periods).toContain('2023');
      expect(periods).toContain('2024');
    });

    it('should return empty data array when goalkeeper has no records', async () => {
      mockRepo.find.mockResolvedValueOnce([]);

      const result = await service.getEvolutionChart('gk-1', 'monthly');

      expect(result.data).toEqual([]);
      expect(result.period).toBe('monthly');
    });

    it('should call repo.find with goalkeeperId filter and ASC date order', async () => {
      await service.getEvolutionChart('gk-99', 'monthly');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { goalkeeperId: 'gk-99' },
        order: { date: 'ASC' },
      });
    });

    it('should default to monthly period when none is provided', async () => {
      const result = await service.getEvolutionChart('gk-1');

      expect(result.period).toBe('monthly');
    });

    it('each chart point should have all required fields', async () => {
      const records = [
        {
          date: new Date('2024-05-01'),
          overallScore: 7,
          highSaveScore: 8,
          lowSaveScore: 6,
          interceptionScore: 7,
          distributionScore: 8,
          positioningScore: 7,
        },
      ] as PerformanceIndex[];

      mockRepo.find.mockResolvedValueOnce(records);

      const result = await service.getEvolutionChart('gk-1', 'monthly');

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          period: expect.any(String),
          overallScore: expect.any(Number),
          highSaveScore: expect.any(Number),
          lowSaveScore: expect.any(Number),
          interceptionScore: expect.any(Number),
          distributionScore: expect.any(Number),
          positioningScore: expect.any(Number),
          count: expect.any(Number),
        }),
      );
    });
  });

  // ─── getRanking ────────────────────────────────────────────────────────────

  describe('getRanking', () => {
    it('should return an array of RankingEntry objects with correct shape', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([
        { goalkeeperId: 'gk-1', avgOverall: '8.50', total: '5' },
        { goalkeeperId: 'gk-2', avgOverall: '6.20', total: '3' },
      ]);

      const result = await service.getRanking();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        goalkeeperId: 'gk-1',
        overallScore: 8.5,
        classification: PerformanceClassification.EXCELLENT,
        totalEvaluations: 5,
      });
      expect(result[1]).toEqual({
        goalkeeperId: 'gk-2',
        overallScore: 6.2,
        classification: PerformanceClassification.REGULAR,
        totalEvaluations: 3,
      });
    });

    it('should return empty array when no performance records exist', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getRanking();

      expect(result).toEqual([]);
    });

    it('should apply innerJoin on goalkeepers and andWhere teamId filter when teamId is provided', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.getRanking('team-99');

      expect(mockQb.innerJoin).toHaveBeenCalledWith(
        'goalkeepers',
        'gk',
        'gk.id = perf.goalkeeperId',
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith('gk.teamId = :teamId', {
        teamId: 'team-99',
      });
    });

    it('should not apply innerJoin when no teamId is provided', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.getRanking();

      expect(mockQb.innerJoin).not.toHaveBeenCalled();
    });

    it('should correctly parse avgOverall and classify each entry', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([
        { goalkeeperId: 'gk-elite', avgOverall: '9.10', total: '10' },
        { goalkeeperId: 'gk-developing', avgOverall: '3.50', total: '2' },
      ]);

      const result = await service.getRanking();

      expect(result[0].classification).toBe(PerformanceClassification.ELITE);
      expect(result[1].classification).toBe(PerformanceClassification.DEVELOPING);
    });

    it('should select groupBy goalkeeperId and order by avgOverall DESC', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.getRanking();

      expect(mockQb.groupBy).toHaveBeenCalledWith('perf.goalkeeperId');
      expect(mockQb.orderBy).toHaveBeenCalledWith('avgOverall', 'DESC');
    });
  });

  // ─── getComparison ─────────────────────────────────────────────────────────

  describe('getComparison', () => {
    it('should return goalkeeper1 and goalkeeper2 keys in the result', async () => {
      mockQb.getMany.mockResolvedValue([]);

      const result = await service.getComparison('gk-1', 'gk-2');

      expect(result).toHaveProperty('goalkeeper1');
      expect(result).toHaveProperty('goalkeeper2');
    });

    it('should return all-zero averageScores and null classification when goalkeeper has no records', async () => {
      mockQb.getMany.mockResolvedValue([]);

      const result = await service.getComparison('gk-1', 'gk-2');

      expect(result.goalkeeper1.averageScores.overallScore).toBe(0);
      expect(result.goalkeeper1.classification).toBeNull();
      expect(result.goalkeeper1.totalEvaluations).toBe(0);
    });

    it('should calculate correct averages and totalEvaluations from records', async () => {
      const gk1Records = [
        {
          overallScore: 8,
          highSaveScore: 9,
          lowSaveScore: 7,
          interceptionScore: 8,
          distributionScore: 8,
          positioningScore: 9,
          reflexScore: 8,
          footworkScore: 7,
          goalExitScore: 10,
          decisionMakingScore: 8,
        },
        {
          overallScore: 6,
          highSaveScore: 7,
          lowSaveScore: 5,
          interceptionScore: 6,
          distributionScore: 6,
          positioningScore: 7,
          reflexScore: 6,
          footworkScore: 5,
          goalExitScore: 8,
          decisionMakingScore: 6,
        },
      ] as PerformanceIndex[];

      mockQb.getMany
        .mockResolvedValueOnce(gk1Records) // gk-1
        .mockResolvedValueOnce([]); // gk-2

      const result = await service.getComparison('gk-1', 'gk-2');

      expect(result.goalkeeper1.totalEvaluations).toBe(2);
      expect(result.goalkeeper1.averageScores.overallScore).toBe(7); // (8+6)/2
      expect(result.goalkeeper1.averageScores.highSaveScore).toBe(8); // (9+7)/2
    });

    it('should classify each goalkeeper based on their average overallScore', async () => {
      const gk1Records = [
        {
          overallScore: 9.5,
          highSaveScore: 9,
          lowSaveScore: 9,
          interceptionScore: 9,
          distributionScore: 9,
          positioningScore: 9,
          reflexScore: 9,
          footworkScore: 9,
          goalExitScore: 9,
          decisionMakingScore: 9,
        },
      ] as PerformanceIndex[];

      const gk2Records = [
        {
          overallScore: 4,
          highSaveScore: 4,
          lowSaveScore: 4,
          interceptionScore: 4,
          distributionScore: 4,
          positioningScore: 4,
          reflexScore: 4,
          footworkScore: 4,
          goalExitScore: 4,
          decisionMakingScore: 4,
        },
      ] as PerformanceIndex[];

      mockQb.getMany
        .mockResolvedValueOnce(gk1Records)
        .mockResolvedValueOnce(gk2Records);

      const result = await service.getComparison('gk-1', 'gk-2');

      expect(result.goalkeeper1.classification).toBe(PerformanceClassification.ELITE);
      expect(result.goalkeeper2.classification).toBe(PerformanceClassification.DEVELOPING);
    });

    it('should apply dateFrom and dateTo filters to both queries when provided', async () => {
      mockQb.getMany.mockResolvedValue([]);

      await service.getComparison('gk-1', 'gk-2', '2024-01-01', '2024-12-31');

      const andWhereCalls = mockQb.andWhere.mock.calls;
      const dateFromCall = andWhereCalls.find(
        (args: any[]) => args[0] === 'perf.date >= :dateFrom',
      );
      const dateToCall = andWhereCalls.find(
        (args: any[]) => args[0] === 'perf.date <= :dateTo',
      );

      expect(dateFromCall).toBeDefined();
      expect(dateToCall).toBeDefined();
    });
  });
});
