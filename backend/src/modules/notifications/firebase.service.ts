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

  // Returns 'sent', or 'invalid' when FCM reports the token is unregistered.
  async sendToToken(
    token: string, title: string, body: string, data?: Record<string, string>,
  ): Promise<'sent' | 'invalid' | 'error'> {
    if (!this.initialized) return 'error';
    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      return 'sent';
    } catch (e: any) {
      const code = e?.errorInfo?.code || e?.code || '';
      const isInvalid =
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument';
      this.logger.warn(`FCM send failed for token ${token.slice(0, 8)}…: ${e.message}`);
      return isInvalid ? 'invalid' : 'error';
    }
  }

  // Sends to many tokens; returns success count and the tokens FCM rejected.
  async sendToTokens(
    tokens: string[], title: string, body: string, data?: Record<string, string>,
  ): Promise<{ success: number; invalidTokens: string[] }> {
    if (!this.initialized || tokens.length === 0) {
      return { success: 0, invalidTokens: [] };
    }
    const results = await Promise.all(
      tokens.map(async (t) => ({
        token: t,
        status: await this.sendToToken(t, title, body, data),
      })),
    );
    return {
      success: results.filter((r) => r.status === 'sent').length,
      invalidTokens: results.filter((r) => r.status === 'invalid').map((r) => r.token),
    };
  }
}
