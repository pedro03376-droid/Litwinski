import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysis, AnalysisSource } from './entities/ai-analysis.entity';

const mockRepo = {
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'uuid-1', ...entity }),
  ),
  find: jest.fn().mockResolvedValue([]),
};

const baseMatchMetrics = {
  highSaveRight: 0,
  highSaveLeft: 0,
  lowSaveRight: 0,
  lowSaveLeft: 0,
  centralSave: 0,
  interceptions: 0,
  launchRightFoot: 1,
  launchLeftFoot: 0,
  launchRightHand: 0,
  positionBaseLeft: 0,
  positionBaseRight: 0,
  goalOutsideArea: 0,
  goalInsideArea: 0,
};

const baseTrainingMetrics = {
  totalExercises: 3,
  successRate: 50,
  avgReactionTime: 0.6,
  categoryBreakdown: {},
};

describe('AiAnalysisService', () => {
  let service: AiAnalysisService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAnalysisService,
        {
          provide: getRepositoryToken(AiAnalysis),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AiAnalysisService>(AiAnalysisService);
  });

  describe('analyzeMatch', () => {
    it('should include "taxa de defesas" in strengths when save rate >= 80%', async () => {
      // 8 saves, 2 goals => 80%
      const metrics = {
        ...baseMatchMetrics,
        highSaveRight: 4,
        highSaveLeft: 4,
        goalInsideArea: 2,
      };

      const result = await service.analyzeMatch('gk-1', 'match-1', metrics);

      expect(result.strengths).toEqual(
        expect.arrayContaining([
          expect.stringContaining('taxa de defesas'),
        ]),
      );
    });

    it('should include "posicionamento" in attentionPoints when save rate < 60%', async () => {
      // 2 saves, 5 goals => ~28.6%
      const metrics = {
        ...baseMatchMetrics,
        centralSave: 2,
        goalInsideArea: 5,
      };

      const result = await service.analyzeMatch('gk-1', 'match-1', metrics);

      expect(result.attentionPoints).toEqual(
        expect.arrayContaining([
          expect.stringContaining('posicionamento'),
        ]),
      );
    });

    it('should populate evolutionNotes when previousMetrics are provided and save rate improved', async () => {
      // Current: 9 saves, 1 goal => 90%
      const metrics = {
        ...baseMatchMetrics,
        highSaveRight: 5,
        highSaveLeft: 4,
        goalInsideArea: 1,
      };
      // Previous: 2 saves, 8 goals => 20%
      const previousMetrics = {
        ...baseMatchMetrics,
        centralSave: 2,
        goalInsideArea: 8,
      };

      const result = await service.analyzeMatch('gk-1', 'match-1', metrics, previousMetrics);

      expect(result.evolutionNotes.length).toBeGreaterThan(0);
      expect(result.evolutionNotes[0]).toContain('%');
    });

    it('should save entity with correct source and return it', async () => {
      const metrics = { ...baseMatchMetrics };

      const result = await service.analyzeMatch('gk-1', 'match-1', metrics);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          goalkeeperId: 'gk-1',
          matchId: 'match-1',
          source: AnalysisSource.MATCH,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('uuid-1');
    });

    it('should return an overall score between 0 and 10', async () => {
      const metrics = {
        ...baseMatchMetrics,
        highSaveRight: 3,
        highSaveLeft: 2,
        goalInsideArea: 1,
      };

      const result = await service.analyzeMatch('gk-1', 'match-1', metrics);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(10);
    });
  });

  describe('analyzeTraining', () => {
    it('should include "taxa de acerto" in strengths when successRate >= 80', async () => {
      const metrics = { ...baseTrainingMetrics, successRate: 85 };

      const result = await service.analyzeTraining('gk-1', 'training-1', metrics);

      expect(result.strengths).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Taxa de acerto'),
        ]),
      );
    });

    it('should populate attentionPoints when successRate < 60', async () => {
      const metrics = { ...baseTrainingMetrics, successRate: 45 };

      const result = await service.analyzeTraining('gk-1', 'training-1', metrics);

      expect(result.attentionPoints.length).toBeGreaterThan(0);
      expect(result.attentionPoints[0]).toContain('60%');
    });

    it('should save entity with correct source and return it', async () => {
      const metrics = { ...baseTrainingMetrics };

      const result = await service.analyzeTraining('gk-1', 'training-1', metrics);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          goalkeeperId: 'gk-1',
          trainingSessionId: 'training-1',
          source: AnalysisSource.TRAINING,
        }),
      );
      expect(result.id).toBe('uuid-1');
    });

    it('should return overall score between 0 and 10', async () => {
      const metrics = { ...baseTrainingMetrics, successRate: 70, totalExercises: 6 };

      const result = await service.analyzeTraining('gk-1', 'training-1', metrics);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(10);
    });
  });

  describe('findByGoalkeeper', () => {
    it('should call repo.find with correct where, order, and take', async () => {
      await service.findByGoalkeeper('gk-42', 5);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { goalkeeperId: 'gk-42' },
        order: { createdAt: 'DESC' },
        take: 5,
      });
    });

    it('should use default limit of 10 when not provided', async () => {
      await service.findByGoalkeeper('gk-42');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('should return the list from the repository', async () => {
      const mockList = [{ id: 'a1' }, { id: 'a2' }] as AiAnalysis[];
      mockRepo.find.mockResolvedValueOnce(mockList);

      const result = await service.findByGoalkeeper('gk-42');

      expect(result).toBe(mockList);
    });
  });

  describe('findByMatch', () => {
    it('should call repo.find with matchId', async () => {
      await service.findByMatch('match-99');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { matchId: 'match-99' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findByTraining', () => {
    it('should call repo.find with trainingSessionId', async () => {
      await service.findByTraining('session-7');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { trainingSessionId: 'session-7' },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
