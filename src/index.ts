/**
 * Prisma will help to pour variables from .env to process.env
 * In production, set env variables instead of using .env file
 */
import '@prisma/client';

import { ApolloServer } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { typeDefs } from '@schema/definition';
import { ReasonDS } from '@datasource/reason';
import { resolvers } from '@resolver';
import { dbClient } from '@db';
import { TransactionDS } from '@datasource/transaction';
import { TokenDS } from '@datasource/token';
import { GmailSmtp } from '@datasource/smtp';
import Config from './config';

(async function startServer() {
  const keyPath = Config.get('ssl_certificates')?.key;
  const certPath = Config.get('ssl_certificates')?.cert;
  const sslEnable = keyPath && certPath;

  const app = express();

  const tokenDs = new TokenDS(dbClient);

  let httpServer;

  if (sslEnable) {
    httpServer = https.createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
      app
    );
  } else {
    httpServer = http.createServer(app);
  }

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    dataSources: () => ({
      tokenDs,
      reasonDs: new ReasonDS(dbClient),
      transactionDs: new TransactionDS(dbClient),
      smtpDs: new GmailSmtp(
        Config.get('smtp_credentials'),
        Config.get('signin_email_template'),
        Config.get('frontend_base_url')
      ),
    }),

    context: async ({ req }) => {
      const token = (req.headers.authorization || '').replace('Bearer ', '');

      let tokenPayload: JwtPayload | null = null;

      try {
        if (!(await tokenDs.isRevoke({ token }))) {
          tokenPayload = token
            ? (jwt.verify(token, Config.get('signin_jwt_secret')) as JwtPayload)
            : null;
        }
      } catch (e) {
        console.error(e);
      }

      return { token, tokenPayload, appConfig: Config };
    },
  });

  await server.start();

  server.applyMiddleware({ app });

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: Config.get('app_port') }, resolve)
  );

  console.log(
    `🚀 Server ready at http${sslEnable ? 's' : ''}://localhost:${Config.get('app_port')}${
      server.graphqlPath
    }`
  );
})();
