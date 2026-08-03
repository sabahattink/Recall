import { join } from 'node:path';
import type {
  DependencyRecord,
  ServiceIntegration,
  ServiceIntegrationCategory,
} from '@recall-ai/schemas';

const SIGNALS: Array<{ dependency: string; category: ServiceIntegrationCategory; name: string }> = [
  { dependency: 'pg', category: 'database', name: 'PostgreSQL (pg)' },
  { dependency: 'mysql2', category: 'database', name: 'MySQL (mysql2)' },
  { dependency: 'mongoose', category: 'database', name: 'MongoDB (mongoose)' },
  { dependency: 'mongodb', category: 'database', name: 'MongoDB (mongodb driver)' },
  { dependency: 'typeorm', category: 'database', name: 'TypeORM' },
  { dependency: 'prisma', category: 'database', name: 'Prisma' },
  { dependency: '@prisma/client', category: 'database', name: 'Prisma Client' },
  { dependency: 'sequelize', category: 'database', name: 'Sequelize' },
  { dependency: 'knex', category: 'database', name: 'Knex' },
  { dependency: 'bullmq', category: 'queue', name: 'BullMQ' },
  { dependency: 'bull', category: 'queue', name: 'Bull' },
  { dependency: 'kafkajs', category: 'queue', name: 'Kafka (kafkajs)' },
  { dependency: 'amqplib', category: 'queue', name: 'RabbitMQ (amqplib)' },
  { dependency: 'ioredis', category: 'cache', name: 'Redis (ioredis)' },
  { dependency: 'redis', category: 'cache', name: 'Redis (redis)' },
  { dependency: 'node-cache', category: 'cache', name: 'node-cache' },
  { dependency: 'passport', category: 'authentication', name: 'Passport.js' },
  { dependency: '@nestjs/passport', category: 'authentication', name: 'NestJS Passport' },
  { dependency: '@nestjs/jwt', category: 'authentication', name: 'NestJS JWT' },
  { dependency: 'jsonwebtoken', category: 'authentication', name: 'JSON Web Tokens' },
  { dependency: 'next-auth', category: 'authentication', name: 'NextAuth.js' },
  { dependency: '@auth0/nextjs-auth0', category: 'authentication', name: 'Auth0' },
  { dependency: 'stripe', category: 'external-service', name: 'Stripe' },
  { dependency: '@sendgrid/mail', category: 'external-service', name: 'SendGrid' },
  { dependency: 'aws-sdk', category: 'external-service', name: 'AWS SDK (v2)' },
  { dependency: '@aws-sdk/client-s3', category: 'external-service', name: 'AWS SDK (S3)' },
  { dependency: '@sentry/node', category: 'external-service', name: 'Sentry' },
  { dependency: 'twilio', category: 'external-service', name: 'Twilio' },
];

export function detectServiceIntegrations(dependencies: DependencyRecord[]): ServiceIntegration[] {
  const results: ServiceIntegration[] = [];
  const byName = new Map<string, DependencyRecord[]>();
  for (const dep of dependencies) {
    const list = byName.get(dep.name) ?? [];
    list.push(dep);
    byName.set(dep.name, list);
  }

  for (const signal of SIGNALS) {
    const matches = byName.get(signal.dependency);
    if (!matches) continue;
    results.push({
      category: signal.category,
      name: signal.name,
      evidence: matches.map((m) => ({
        path: m.workspace
          ? join(m.workspace, 'package.json').split('\\').join('/')
          : 'package.json',
        reason: `declares dependency "${signal.dependency}"`,
      })),
    });
  }

  return results;
}
