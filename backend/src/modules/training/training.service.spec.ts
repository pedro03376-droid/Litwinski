import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TrainingService } from './training.service';
import {
  TrainingSession,
  TrainingCategory,
  TrainingIntensity,
} from './entities/training-session.entity';
import { Exercise } from './entities/exercise.entity';
import { ExerciseResult } from './entities/exercise-result.entity';

// ── query-builder mock ────────────────────────────────────────────────────────

const qbMock = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(0),
  getMany: jest.fn().mockResolvedValue([]),
};

// ── repository mocks ──────────────────────────────────────────────────────────

const mockSessionRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(qbMock),
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'session-uuid-1', ...entity }),
  ),
  merge: jest.fn().mockImplementation((target, source) => ({ ...target, ...source })),
  remove: jest.fn().mockResolvedValue(undefined),
};

const mockExerciseRepo = {
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'exercise-uuid-1', ...entity }),
  ),
  merge: jest.fn().mockImplementation((target, source) => ({ ...target, ...source })),
};

const mockResultRepo = {
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'result-uuid-1', ...entity }),
  ),
  merge: jest.fn().mockImplementation((target, source) => ({ ...target, ...source })),
};

// ── base fixtures ─────────────────────────────────────────────────────────────

const baseSessionDto = {
  date: '2025-06-01',
  category: TrainingCategory.REFLEX,
  objective: 'Improve reflexes',
  durationMinutes: 60,
  intensity: TrainingIntensity.MEDIUM,
  goalkeeperId: 'gk-1',
};

const baseSession: Partial<TrainingSession> = {
  id: 'session-1',
  date: new Date('2025-06-01'),
  category: TrainingCategory.REFLEX,
  objective: 'Improve reflexes',
  durationMinutes: 60,
  intensity: TrainingIntensity.MEDIUM,
  goalkeeperId: 'gk-1',
  exercises: [],
  aiAnalyses: [],
};

const baseExerciseDto = {
  name: 'Ball drop drill',
  objective: 'Reaction speed',
  sets: 3,
  repetitions: 10,
};

const baseExercise: Partial<Exercise> = {
  id: 'exercise-1',
  name: 'Ball drop drill',
  trainingSessionId: 'session-1',
  result: undefined,
};

const baseResultDto = {
  attempts: 10,
  successes: 8,
  errors: 2,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('TrainingService', () => {
  let service: TrainingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // reset qbMock defaults
    qbMock.getCount.mockResolvedValue(0);
    qbMock.getMany.mockResolvedValue([]);
    mockSessionRepo.createQueryBuilder.mockReturnValue(qbMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingService,
        {
          provide: getRepositoryToken(TrainingSession),
          useValue: mockSessionRepo,
        },
        {
          provide: getRepositoryToken(Exercise),
          useValue: mockExerciseRepo,
        },
        {
          provide: getRepositoryToken(ExerciseResult),
          useValue: mockResultRepo,
        },
      ],
    }).compile();

    service = module.get<TrainingService>(TrainingService);
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return a paginated result with defaults when no options provided', async () => {
      const sessions = [baseSession as TrainingSession];
      qbMock.getCount.mockResolvedValue(1);
      qbMock.getMany.mockResolvedValue(sessions);

      const result = await service.findAll('gk-1');

      expect(result.data).toBe(sessions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply goalkeeperId filter via andWhere', async () => {
      await service.findAll('gk-1');

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'session.goalkeeperId = :goalkeeperId',
        { goalkeeperId: 'gk-1' },
      );
    });

    it('should apply category filter when provided', async () => {
      await service.findAll('gk-1', { category: TrainingCategory.REFLEX });

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'session.category = :category',
        { category: TrainingCategory.REFLEX },
      );
    });

    it('should apply intensity filter when provided', async () => {
      await service.findAll('gk-1', { intensity: TrainingIntensity.HIGH });

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'session.intensity = :intensity',
        { intensity: TrainingIntensity.HIGH },
      );
    });

    it('should apply dateFrom and dateTo filters when provided', async () => {
      await service.findAll('gk-1', { dateFrom: '2025-01-01', dateTo: '2025-12-31' });

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'session.date >= :dateFrom',
        { dateFrom: '2025-01-01' },
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'session.date <= :dateTo',
        { dateTo: '2025-12-31' },
      );
    });

    it('should apply skip/take based on pagination options', async () => {
      await service.findAll('gk-1', {}, { page: 2, limit: 10 });

      // (2-1) * 10 = 10
      expect(qbMock.skip).toHaveBeenCalledWith(10);
      expect(qbMock.take).toHaveBeenCalledWith(10);
    });

    it('should calculate totalPages correctly for partial last page', async () => {
      qbMock.getCount.mockResolvedValue(25);
      qbMock.getMany.mockResolvedValue([]);

      const result = await service.findAll('gk-1', {}, { page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
    });

    it('should throw BadRequestException when page < 1', async () => {
      await expect(
        service.findAll('gk-1', {}, { page: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when limit > 100', async () => {
      await expect(
        service.findAll('gk-1', {}, { limit: 101 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when limit < 1', async () => {
      await expect(
        service.findAll('gk-1', {}, { limit: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the session with relations when found', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(baseSession as TrainingSession);

      const result = await service.findOne('session-1');

      expect(result).toBe(baseSession);
      expect(mockSessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          relations: expect.arrayContaining(['exercises', 'goalkeeper', 'aiAnalyses']),
        }),
      );
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include exercises.result in relations', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(baseSession as TrainingSession);

      await service.findOne('session-1');

      expect(mockSessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['exercises.result']),
        }),
      );
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and save a session with the date converted to a Date object', async () => {
      const result = await service.create(baseSessionDto);

      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          objective: 'Improve reflexes',
          date: new Date('2025-06-01'),
        }),
      );
      expect(mockSessionRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('session-uuid-1');
    });

    it('should pass all dto fields to the repository', async () => {
      await service.create(baseSessionDto);

      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: TrainingCategory.REFLEX,
          intensity: TrainingIntensity.MEDIUM,
          durationMinutes: 60,
          goalkeeperId: 'gk-1',
        }),
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should merge dto into existing session and save', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(baseSession as TrainingSession);

      const updateDto = { objective: 'Updated objective' };
      const result = await service.update('session-1', updateDto);

      expect(mockSessionRepo.merge).toHaveBeenCalledWith(
        baseSession,
        expect.objectContaining({ objective: 'Updated objective' }),
      );
      expect(mockSessionRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should convert dto.date string to Date when provided', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(baseSession as TrainingSession);

      await service.update('session-1', { date: '2025-07-15' });

      expect(mockSessionRepo.merge).toHaveBeenCalledWith(
        baseSession,
        expect.objectContaining({ date: new Date('2025-07-15') }),
      );
    });

    it('should throw NotFoundException when session not found', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update('nonexistent-id', { objective: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should find the session and call repo.remove', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(baseSession as TrainingSession);

      await service.remove('session-1');

      expect(mockSessionRepo.remove).toHaveBeenCalledWith(baseSession);
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return void on success', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(baseSession as TrainingSession);

      const result = await service.remove('session-1');

      expect(result).toBeUndefined();
    });
  });

  // ── addExercise ────────────────────────────────────────────────────────────

  describe('addExercise', () => {
    it('should create and save an exercise linked to the session', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(baseSession as TrainingSession);

      const result = await service.addExercise('session-1', baseExerciseDto);

      expect(mockExerciseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...baseExerciseDto,
          trainingSessionId: 'session-1',
        }),
      );
      expect(mockExerciseRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('exercise-uuid-1');
    });

    it('should throw NotFoundException when session does not exist', async () => {
      mockSessionRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.addExercise('nonexistent-session', baseExerciseDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateExercise ─────────────────────────────────────────────────────────

  describe('updateExercise', () => {
    it('should merge dto into exercise and save', async () => {
      mockExerciseRepo.findOne.mockResolvedValueOnce(baseExercise as Exercise);

      const updateDto = { name: 'Updated drill' };
      const result = await service.updateExercise('exercise-1', updateDto);

      expect(mockExerciseRepo.merge).toHaveBeenCalledWith(baseExercise, updateDto);
      expect(mockExerciseRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when exercise does not exist', async () => {
      mockExerciseRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateExercise('nonexistent-exercise', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── addExerciseResult ──────────────────────────────────────────────────────

  describe('addExerciseResult', () => {
    it('should create a new result when the exercise has no existing result', async () => {
      const exerciseWithoutResult = { ...baseExercise, result: undefined } as Exercise;
      mockExerciseRepo.findOne.mockResolvedValueOnce(exerciseWithoutResult);

      const result = await service.addExerciseResult('exercise-1', baseResultDto);

      expect(mockResultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: 10,
          successes: 8,
          exerciseId: 'exercise-1',
        }),
      );
      expect(mockResultRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('result-uuid-1');
    });

    it('should merge into existing result when one already exists', async () => {
      const existingResult = { id: 'result-existing', attempts: 5, successes: 3 } as ExerciseResult;
      const exerciseWithResult = { ...baseExercise, result: existingResult } as Exercise;
      mockExerciseRepo.findOne.mockResolvedValueOnce(exerciseWithResult);

      await service.addExerciseResult('exercise-1', baseResultDto);

      expect(mockResultRepo.merge).toHaveBeenCalledWith(
        existingResult,
        expect.objectContaining({ attempts: 10, successes: 8 }),
      );
      expect(mockResultRepo.save).toHaveBeenCalledWith(existingResult);
    });

    it('should calculate successPercentage from attempts and successes when not provided', async () => {
      // 8 successes / 10 attempts = 80.00%
      mockExerciseRepo.findOne.mockResolvedValueOnce({
        ...baseExercise,
        result: undefined,
      } as Exercise);

      await service.addExerciseResult('exercise-1', { attempts: 10, successes: 8, errors: 2 });

      expect(mockResultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ successPercentage: 80 }),
      );
    });

    it('should use provided successPercentage when explicitly set', async () => {
      mockExerciseRepo.findOne.mockResolvedValueOnce({
        ...baseExercise,
        result: undefined,
      } as Exercise);

      await service.addExerciseResult('exercise-1', {
        attempts: 10,
        successes: 8,
        errors: 2,
        successPercentage: 75,
      });

      expect(mockResultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ successPercentage: 75 }),
      );
    });

    it('should set successPercentage to 0 when attempts is 0', async () => {
      mockExerciseRepo.findOne.mockResolvedValueOnce({
        ...baseExercise,
        result: undefined,
      } as Exercise);

      await service.addExerciseResult('exercise-1', { attempts: 0, successes: 0, errors: 0 });

      expect(mockResultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ successPercentage: 0 }),
      );
    });

    it('should throw NotFoundException when exercise does not exist', async () => {
      mockExerciseRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.addExerciseResult('nonexistent-exercise', baseResultDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getTrainingStats ───────────────────────────────────────────────────────

  describe('getTrainingStats', () => {
    it('should return zero-value stats when goalkeeper has no sessions', async () => {
      mockSessionRepo.find.mockResolvedValueOnce([]);

      const stats = await service.getTrainingStats('gk-1');

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalHours).toBe(0);
      expect(stats.totalExercises).toBe(0);
      expect(stats.totalAttempts).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.overallSuccessPercentage).toBe(0);
      expect(stats.averageSuccessRate).toBe(0);
    });

    it('should count totalSessions correctly', async () => {
      const sessions = [
        { ...baseSession, exercises: [] },
        { ...baseSession, id: 'session-2', exercises: [] },
      ] as TrainingSession[];
      mockSessionRepo.find.mockResolvedValueOnce(sessions);

      const stats = await service.getTrainingStats('gk-1');

      expect(stats.totalSessions).toBe(2);
    });

    it('should compute totalHours from durationMinutes', async () => {
      // 90 min = 1.5 hours
      const sessions = [
        { ...baseSession, durationMinutes: 90, exercises: [] },
      ] as TrainingSession[];
      mockSessionRepo.find.mockResolvedValueOnce(sessions);

      const stats = await service.getTrainingStats('gk-1');

      expect(stats.totalHours).toBe(1.5);
    });

    it('should compute overallSuccessPercentage from aggregate attempts and successes', async () => {
      // 8 successes / 10 attempts = 80%
      const result = { attempts: 10, successes: 8 } as ExerciseResult;
      const exercise = { ...baseExercise, result } as Exercise;
      const sessions = [
        { ...baseSession, exercises: [exercise] },
      ] as TrainingSession[];
      mockSessionRepo.find.mockResolvedValueOnce(sessions);

      const stats = await service.getTrainingStats('gk-1');

      expect(stats.overallSuccessPercentage).toBe(80);
    });

    it('should include all TrainingCategory values in categoryBreakdown', async () => {
      mockSessionRepo.find.mockResolvedValueOnce([]);

      const stats = await service.getTrainingStats('gk-1');

      for (const cat of Object.values(TrainingCategory)) {
        expect(stats.categoryBreakdown).toHaveProperty(cat);
      }
    });

    it('should include all TrainingIntensity values in intensityBreakdown', async () => {
      mockSessionRepo.find.mockResolvedValueOnce([]);

      const stats = await service.getTrainingStats('gk-1');

      for (const intensity of Object.values(TrainingIntensity)) {
        expect(stats.intensityBreakdown).toHaveProperty(intensity);
      }
    });

    it('should count category occurrences in categoryBreakdown', async () => {
      const sessions = [
        { ...baseSession, category: TrainingCategory.REFLEX, exercises: [] },
        { ...baseSession, id: 's2', category: TrainingCategory.REFLEX, exercises: [] },
        { ...baseSession, id: 's3', category: TrainingCategory.AGILITY, exercises: [] },
      ] as TrainingSession[];
      mockSessionRepo.find.mockResolvedValueOnce(sessions);

      const stats = await service.getTrainingStats('gk-1');

      expect(stats.categoryBreakdown[TrainingCategory.REFLEX]).toBe(2);
      expect(stats.categoryBreakdown[TrainingCategory.AGILITY]).toBe(1);
    });

    it('should count totalExercises across all sessions', async () => {
      const exercise1 = { ...baseExercise, result: undefined } as Exercise;
      const exercise2 = { ...baseExercise, id: 'ex-2', result: undefined } as Exercise;
      const sessions = [
        { ...baseSession, exercises: [exercise1, exercise2] },
      ] as TrainingSession[];
      mockSessionRepo.find.mockResolvedValueOnce(sessions);

      const stats = await service.getTrainingStats('gk-1');

      expect(stats.totalExercises).toBe(2);
    });

    it('should compute averageSuccessRate as per-session average of success ratios', async () => {
      // Session 1: 10 attempts, 10 successes => ratio 1.0
      // Session 2: 10 attempts, 0 successes  => ratio 0.0
      // average => 0.5 => 50%
      const result1 = { attempts: 10, successes: 10 } as ExerciseResult;
      const result2 = { attempts: 10, successes: 0 } as ExerciseResult;
      const sessions = [
        { ...baseSession, id: 's1', exercises: [{ ...baseExercise, result: result1 } as Exercise] },
        { ...baseSession, id: 's2', exercises: [{ ...baseExercise, id: 'ex-2', result: result2 } as Exercise] },
      ] as TrainingSession[];
      mockSessionRepo.find.mockResolvedValueOnce(sessions);

      const stats = await service.getTrainingStats('gk-1');

      expect(stats.averageSuccessRate).toBe(50);
    });

    it('should query with goalkeeperId and load exercises and results relations', async () => {
      mockSessionRepo.find.mockResolvedValueOnce([]);

      await service.getTrainingStats('gk-42');

      expect(mockSessionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { goalkeeperId: 'gk-42' },
          relations: expect.arrayContaining(['exercises', 'exercises.result']),
        }),
      );
    });

    it('should return a stats object with all required keys', async () => {
      mockSessionRepo.find.mockResolvedValueOnce([]);

      const stats = await service.getTrainingStats('gk-1');

      expect(stats).toEqual(
        expect.objectContaining({
          totalSessions: expect.any(Number),
          totalHours: expect.any(Number),
          averageSuccessRate: expect.any(Number),
          categoryBreakdown: expect.any(Object),
          intensityBreakdown: expect.any(Object),
          totalExercises: expect.any(Number),
          totalAttempts: expect.any(Number),
          totalSuccesses: expect.any(Number),
          overallSuccessPercentage: expect.any(Number),
        }),
      );
    });
  });
});
