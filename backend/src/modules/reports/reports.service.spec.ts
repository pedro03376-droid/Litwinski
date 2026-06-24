jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn().mockReturnThis(),
    end: jest.fn(),
    pipe: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    rect: jest.fn().mockReturnThis(),
    fill: jest.fn().mockReturnThis(),
    save: jest.fn().mockReturnThis(),
    restore: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    strokeColor: jest.fn().mockReturnThis(),
    lineWidth: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    roundedRect: jest.fn().mockReturnThis(),
    circle: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    x: 0,
    y: 0,
    page: {
      width: 595,
      height: 842,
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    },
  }));
});

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createWriteStream: jest.fn().mockReturnValue({
    on: jest.fn((evt: string, cb: () => void) => (evt === 'finish' ? cb() : null)),
  }),
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Report, ReportType } from './entities/report.entity';

// ─── Mock fixtures ──────────────────────────────────────────────────────────

const mockGoalkeeperRow = {
  id: 'gk-1',
  name: 'Ana Costa',
  team_name: 'GK Hub FC',
  category: 'Sub-20',
  birthdate: new Date('2004-05-10'),
  height: 1.72,
};

const mockMatchRow = {
  id: 'match-1',
  opponent: 'Rival FC',
  competition: 'Copa Regional',
  date: new Date('2025-06-01'),
  location: 'home',
  result: 'win',
  goalsScored: 2,
  goalsConceded: 0,
};

const mockPerfRow = {
  overallScore: '8.5',
  reflexScore: '9.0',
  highSaveScore: '8.0',
  lowSaveScore: '7.5',
  positioningScore: '8.2',
  goalExitScore: '8.0',
  footworkScore: '7.8',
  distributionScore: '8.1',
  decisionMakingScore: '8.3',
};

const mockHistoryRow = { avg_score: '7.8' };

const mockMatchStatsRow = {
  total: '10',
  wins: '6',
  draws: '2',
  losses: '2',
  total_goals_conceded: '8',
  clean_sheets: '4',
};

const mockPerfStatsRow = {
  avg_overall: '8.0',
  avg_reflex: '8.5',
  avg_high_save: '7.9',
  avg_low_save: '7.7',
  avg_positioning: '8.1',
  avg_goal_exit: '7.8',
  avg_distribution: '7.6',
  best_score: '9.5',
  worst_score: '6.0',
};

const mockTrainingRow = {
  total_sessions: '5',
  total_minutes: '300',
  categories_trained: '3',
};

const mockEvolutionRows = [
  { date: new Date('2025-01-01'), overallScore: '7.0' },
  { date: new Date('2025-02-01'), overallScore: '7.5' },
];

const mockSessionRow = {
  id: 'session-1',
  date: new Date('2025-06-10'),
  category: 'Reflexo',
  intensity: 'Alta',
  durationMinutes: 90,
  objective: 'Melhorar reflexo',
  season: '2025',
  observations: 'Bom desempenho',
  exercises: [
    {
      name: 'Defesa de chute cruzado',
      sets: 3,
      repetitions: 10,
      attempts: 30,
      successes: 25,
      errors: 5,
      successPercentage: 83.33,
      reactionTime: 0.45,
    },
  ],
};

// ─── Repository mock ─────────────────────────────────────────────────────────

const mockReportRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'report-uuid', ...dto })),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'report-uuid', createdAt: new Date(), ...entity }),
  ),
  remove: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
};

// ─── DataSource mock ─────────────────────────────────────────────────────────

const mockDataSource = {
  query: jest.fn().mockResolvedValue([mockGoalkeeperRow]),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default DataSource.query returns goalkeeper row; individual tests override as needed
    mockDataSource.query.mockResolvedValue([mockGoalkeeperRow]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockReportRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should call reportRepo.find with no where clause when no goalkeeperId provided', async () => {
      mockReportRepo.find.mockResolvedValueOnce([]);

      await service.findAll();

      expect(mockReportRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        relations: ['goalkeeper'],
      });
    });

    it('should call reportRepo.find with where:{goalkeeperId} when goalkeeperId is provided', async () => {
      mockReportRepo.find.mockResolvedValueOnce([]);

      await service.findAll('gk-1');

      expect(mockReportRepo.find).toHaveBeenCalledWith({
        where: { goalkeeperId: 'gk-1' },
        order: { createdAt: 'DESC' },
        relations: ['goalkeeper'],
      });
    });

    it('should return the list from the repository', async () => {
      const mockList = [{ id: 'r1' }, { id: 'r2' }] as Report[];
      mockReportRepo.find.mockResolvedValueOnce(mockList);

      const result = await service.findAll();

      expect(result).toBe(mockList);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the report when found', async () => {
      const mockReport = { id: 'r-1', type: ReportType.MATCH } as Report;
      mockReportRepo.findOne.mockResolvedValueOnce(mockReport);

      const result = await service.findOne('r-1');

      expect(mockReportRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        relations: ['goalkeeper'],
      });
      expect(result).toBe(mockReport);
    });

    it('should throw NotFoundException when report is not found', async () => {
      mockReportRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete PDF file and remove entity when report exists', async () => {
      const mockReport = {
        id: 'r-1',
        pdfUrl: '/uploads/reports/match_gk-1_12345.pdf',
      } as Report;
      mockReportRepo.findOne.mockResolvedValueOnce(mockReport);
      mockReportRepo.remove.mockResolvedValueOnce(undefined);

      const fs = require('fs');

      await service.remove('r-1');

      expect(fs.existsSync).toHaveBeenCalledWith('.' + mockReport.pdfUrl);
      expect(fs.unlinkSync).toHaveBeenCalledWith('.' + mockReport.pdfUrl);
      expect(mockReportRepo.remove).toHaveBeenCalledWith(mockReport);
    });

    it('should still remove entity even when pdfUrl is absent', async () => {
      const mockReport = { id: 'r-1', pdfUrl: undefined } as Report;
      mockReportRepo.findOne.mockResolvedValueOnce(mockReport);
      mockReportRepo.remove.mockResolvedValueOnce(undefined);

      const fs = require('fs');

      await service.remove('r-1');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(mockReportRepo.remove).toHaveBeenCalledWith(mockReport);
    });

    it('should throw NotFoundException when report to remove is not found', async () => {
      mockReportRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.remove('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── generateMatchReport ──────────────────────────────────────────────────

  describe('generateMatchReport', () => {
    beforeEach(() => {
      // Sequence: goalkeeper query, match query, performance query, history query
      mockDataSource.query
        .mockResolvedValueOnce([mockGoalkeeperRow])  // goalkeeper + team
        .mockResolvedValueOnce([mockMatchRow])        // match
        .mockResolvedValueOnce([mockPerfRow])         // performance_indexes
        .mockResolvedValueOnce([mockHistoryRow]);     // historical avg
    });

    it('should call dataSource.query at least twice (goalkeeper and match)', async () => {
      await service.generateMatchReport('gk-1', 'match-1');

      expect(mockDataSource.query.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should call reportRepo.create with correct type and goalkeeperId', async () => {
      await service.generateMatchReport('gk-1', 'match-1');

      expect(mockReportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReportType.MATCH,
          goalkeeperId: 'gk-1',
          metadata: { matchId: 'match-1' },
        }),
      );
    });

    it('should call reportRepo.save and return the saved entity', async () => {
      const result = await service.generateMatchReport('gk-1', 'match-1');

      expect(mockReportRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('report-uuid');
    });

    it('should include opponent name in report title when match has opponent', async () => {
      await service.generateMatchReport('gk-1', 'match-1');

      const createArg = mockReportRepo.create.mock.calls[0][0];
      expect(createArg.title).toContain(mockMatchRow.opponent);
    });
  });

  // ─── generatePeriodReport ────────────────────────────────────────────────

  describe('generatePeriodReport', () => {
    const dateFrom = new Date('2025-01-01');
    const dateTo = new Date('2025-06-30');

    beforeEach(() => {
      // Sequence: goalkeeper, matchStats, perfStats, training, evolution
      mockDataSource.query
        .mockResolvedValueOnce([mockGoalkeeperRow])  // goalkeeper + team
        .mockResolvedValueOnce([mockMatchStatsRow])  // match stats
        .mockResolvedValueOnce([mockPerfStatsRow])   // performance averages
        .mockResolvedValueOnce([mockTrainingRow])    // training sessions
        .mockResolvedValueOnce(mockEvolutionRows);   // evolution data
    });

    it('should call dataSource.query multiple times for all stats', async () => {
      await service.generatePeriodReport('gk-1', dateFrom, dateTo);

      // goalkeeper + matchStats + perfStats + training + evolution = 5 calls
      expect(mockDataSource.query.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('should call reportRepo.create with correct type, goalkeeperId, dateFrom, dateTo', async () => {
      await service.generatePeriodReport('gk-1', dateFrom, dateTo);

      expect(mockReportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReportType.PERIOD,
          goalkeeperId: 'gk-1',
          dateFrom,
          dateTo,
        }),
      );
    });

    it('should call reportRepo.save and return the saved entity', async () => {
      const result = await service.generatePeriodReport('gk-1', dateFrom, dateTo);

      expect(mockReportRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('report-uuid');
    });

    it('should include formatted date range in report title', async () => {
      await service.generatePeriodReport('gk-1', dateFrom, dateTo);

      const createArg = mockReportRepo.create.mock.calls[0][0];
      // Title should contain a date fragment from the period (locale-formatted)
      expect(createArg.title).toContain('Período');
    });
  });

  // ─── generateTrainingReport ───────────────────────────────────────────────

  describe('generateTrainingReport', () => {
    beforeEach(() => {
      // Sequence: goalkeeper query, session query
      mockDataSource.query
        .mockResolvedValueOnce([mockGoalkeeperRow])  // goalkeeper + team
        .mockResolvedValueOnce([mockSessionRow]);    // training session with exercises
    });

    it('should call dataSource.query twice (goalkeeper and session)', async () => {
      await service.generateTrainingReport('gk-1', 'session-1');

      expect(mockDataSource.query.mock.calls.length).toBe(2);
    });

    it('should call reportRepo.create with correct type and goalkeeperId', async () => {
      await service.generateTrainingReport('gk-1', 'session-1');

      expect(mockReportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ReportType.TRAINING,
          goalkeeperId: 'gk-1',
          metadata: { trainingSessionId: 'session-1' },
        }),
      );
    });

    it('should call reportRepo.save and return the saved entity', async () => {
      const result = await service.generateTrainingReport('gk-1', 'session-1');

      expect(mockReportRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('report-uuid');
    });

    it('should include session date in report title when session has a date', async () => {
      await service.generateTrainingReport('gk-1', 'session-1');

      const createArg = mockReportRepo.create.mock.calls[0][0];
      expect(createArg.title).toContain('Treino');
    });

    it('should fall back to trainingSessionId in title when session has no date', async () => {
      // Override so session has no date
      mockDataSource.query
        .mockReset()
        .mockResolvedValueOnce([mockGoalkeeperRow])
        .mockResolvedValueOnce([{ ...mockSessionRow, date: undefined }]);

      await service.generateTrainingReport('gk-1', 'session-fallback');

      const createArg = mockReportRepo.create.mock.calls[0][0];
      expect(createArg.title).toContain('session-fallback');
    });
  });
});
