import {
  Controller, Post, UploadedFile, UseInterceptors,
  Body, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImportService } from './import.service';

@ApiTags('import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Preview Excel file columns and first rows' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File) {
    return this.importService.previewExcel(file.path);
  }

  @Post('matches')
  @ApiOperation({ summary: 'Import matches from Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importMatches(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { goalkeeperId: string; columnMapping: string },
  ) {
    const mapping = JSON.parse(body.columnMapping || '{}');
    return this.importService.importMatches(file.path, body.goalkeeperId, mapping);
  }

  @Post('goalkeepers')
  @ApiOperation({ summary: 'Import goalkeepers from Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importGoalkeepers(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { teamId: string; columnMapping: string },
  ) {
    const mapping = JSON.parse(body.columnMapping || '{}');
    return this.importService.importGoalkeepers(file.path, body.teamId, mapping);
  }
}
