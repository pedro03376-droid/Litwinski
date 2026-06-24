import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set – push notifications disabled');
      return;
    }
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin initialized');
    } catch (e) {
      this.logger.error('Failed to init Firebase Admin', e);
    }
  }

  async sendToToken(token: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`FCM send failed for token ${token.slice(0,8)}…: ${e.message}`);
      return false;
    }
  }

  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<number> {
    if (!this.initialized || tokens.length === 0) return 0;
    const results = await Promise.allSettled(tokens.map(t => this.sendToToken(t, title, body, data)));
    return results.filter(r => r.status === 'fulfilled' && r.value).length;
  }
}
