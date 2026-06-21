import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { Goalkeeper } from '../goalkeepers/entities/goalkeeper.entity';
import { Match } from '../matches/entities/match.entity';
import { MatchScout } from '../scouts/entities/match-scout.entity';

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  preview?: any[];
}

@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(Goalkeeper) private readonly gkRepo: Repository<Goalkeeper>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchScout) private readonly scoutRepo: Repository<MatchScout>,
  ) {}

  async previewExcel(filePath: string): Promise<{ headers: string[]; rows: any[]; sheetNames: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    const sheet = workbook.worksheets[0];
    const headers: string[] = [];
    const rows: any[] = [];

    sheet.getRow(1).eachCell((cell) => headers.push(String(cell.value || '')));

    let rowCount = 0;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || rowCount >= 5) return;
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        rowData[headers[colNumber - 1]] = cell.value;
      });
      rows.push(rowData);
      rowCount++;
    });

    fs.unlinkSync(filePath);
    return { headers, rows, sheetNames };
  }

  async importMatches(
    filePath: string,
    goalkeeperId: string,
    columnMapping: Record<string, string>,
  ): Promise<ImportResult> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.worksheets[0];

      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell) => headers.push(String(cell.value || '')));

      const rows: any[][] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData: any[] = [];
        row.eachCell((cell) => rowData.push(cell.value));
        rows.push(rowData);
      });

      for (const [index, row] of rows.entries()) {
        try {
          const rowMap: Record<string, any> = {};
          headers.forEach((h, i) => { rowMap[h] = row[i]; });

          const matchData: Partial<Match> = {
            goalkeeperId,
            date: this.parseDate(rowMap[columnMapping['date']]),
            competition: String(rowMap[columnMapping['competition']] || 'N/A'),
            opponent: String(rowMap[columnMapping['opponent']] || 'N/A'),
            goalsScored: parseInt(rowMap[columnMapping['goalsScored']] || '0'),
            goalsConceded: parseInt(rowMap[columnMapping['goalsConceded']] || '0'),
          };

          const match = this.matchRepo.create(matchData);
          const savedMatch = await this.matchRepo.save(match);

          // Import scout data if columns mapped
          if (columnMapping['highSaveRight'] || columnMapping['totalSaves']) {
            const scoutData: Partial<MatchScout> = {
              matchId: savedMatch.id,
              highSaveRight: parseInt(rowMap[columnMapping['highSaveRight']] || '0'),
              highSaveLeft: parseInt(rowMap[columnMapping['highSaveLeft']] || '0'),
              lowSaveRight: parseInt(rowMap[columnMapping['lowSaveRight']] || '0'),
              lowSaveLeft: parseInt(rowMap[columnMapping['lowSaveLeft']] || '0'),
              interceptions: parseInt(rowMap[columnMapping['interceptions']] || '0'),
              goalInsideArea: parseInt(rowMap[columnMapping['goalInsideArea']] || '0'),
              goalOutsideArea: parseInt(rowMap[columnMapping['goalOutsideArea']] || '0'),
            };
            await this.scoutRepo.save(this.scoutRepo.create(scoutData));
          }

          imported++;
        } catch (err) {
          errors.push(`Linha ${index + 2}: ${err.message}`);
        }
      }

      fs.unlinkSync(filePath);
    } catch (err) {
      throw new BadRequestException(`Erro ao processar arquivo: ${err.message}`);
    }

    return { success: true, imported, errors };
  }

  async importGoalkeepers(
    filePath: string,
    teamId: string,
    columnMapping: Record<string, string>,
  ): Promise<ImportResult> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.worksheets[0];

      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell) => headers.push(String(cell.value || '')));

      const collectedRows: { rowNumber: number; rowMap: Record<string, any> }[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowMap: Record<string, any> = {};
        headers.forEach((h, i) => { rowMap[h] = (row.getCell(i + 1)).value; });
        collectedRows.push({ rowNumber, rowMap });
      });

      fs.unlinkSync(filePath);

      for (const { rowNumber, rowMap } of collectedRows) {
        try {
          const gkData: Partial<Goalkeeper> = {
            teamId,
            name: String(rowMap[columnMapping['name']] || ''),
            birthDate: this.parseDate(rowMap[columnMapping['birthDate']]),
            category: String(rowMap[columnMapping['category']] || 'Geral'),
            height: parseFloat(rowMap[columnMapping['height']] || '0') || undefined,
            weight: parseFloat(rowMap[columnMapping['weight']] || '0') || undefined,
          };

          if (gkData.name) {
            await this.gkRepo.save(this.gkRepo.create(gkData));
            imported++;
          }
        } catch (err) {
          errors.push(`Linha ${rowNumber}: ${err.message}`);
        }
      }
    } catch (err) {
      throw new BadRequestException(`Erro ao processar arquivo: ${err.message}`);
    }

    return { success: true, imported, errors };
  }

  private parseDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
    // Try DD/MM/YYYY format
    const parts = String(value).split('/');
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    }
    return new Date();
  }
}
