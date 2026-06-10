import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get('SUPABASE_URL');
    const key = this.configService.get('SUPABASE_SERVICE_KEY');
    if (url && key) {
      this.supabase = createClient(url, key);
    }
  }

  async uploadVideo(
    filePath: string,
    fileName: string,
    goalkeeperId: string,
  ): Promise<string> {
    if (this.supabase) {
      const bucket = this.configService.get('SUPABASE_BUCKET_VIDEOS', 'gkhub-videos');
      const fileBuffer = fs.readFileSync(filePath);
      const remotePath = `${goalkeeperId}/${Date.now()}_${fileName}`;

      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(remotePath, fileBuffer, { upsert: false });

      if (error) throw new Error(`Supabase upload failed: ${error.message}`);

      const { data: urlData } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      fs.unlinkSync(filePath);
      return urlData.publicUrl;
    }

    // Fallback: local storage
    const uploadDir = path.join('./uploads/videos', goalkeeperId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const dest = path.join(uploadDir, `${Date.now()}_${fileName}`);
    fs.renameSync(filePath, dest);
    return `/uploads/videos/${goalkeeperId}/${Date.now()}_${fileName}`;
  }

  async uploadPhoto(
    filePath: string,
    fileName: string,
    goalkeeperId: string,
  ): Promise<string> {
    if (this.supabase) {
      const bucket = this.configService.get('SUPABASE_BUCKET_PHOTOS', 'gkhub-photos');
      const fileBuffer = fs.readFileSync(filePath);
      const remotePath = `${goalkeeperId}/${Date.now()}_${fileName}`;

      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(remotePath, fileBuffer, { upsert: false });

      if (error) throw new Error(`Supabase upload failed: ${error.message}`);

      const { data: urlData } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      fs.unlinkSync(filePath);
      return urlData.publicUrl;
    }

    const uploadDir = path.join('./uploads/photos', goalkeeperId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const dest = path.join(uploadDir, `${Date.now()}_${fileName}`);
    fs.renameSync(filePath, dest);
    return `/uploads/photos/${goalkeeperId}/${path.basename(dest)}`;
  }

  async deleteFile(url: string, bucket?: string): Promise<void> {
    if (this.supabase && url.includes('supabase')) {
      const urlParts = url.split('/');
      const filePath = urlParts.slice(-2).join('/');
      await this.supabase.storage.from(bucket || 'gkhub-videos').remove([filePath]);
    } else {
      const localPath = '.' + new URL(url, 'http://localhost').pathname;
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }
  }
}
