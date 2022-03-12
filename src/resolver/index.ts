import { ApolloError } from 'apollo-server-errors';

import { Resolvers } from '@schema/types.generated';

export const resolvers: Resolvers = {
  Query: {
    getReasons: (_, __, context) => {
      const { reasonDs } = context.dataSources;
      return reasonDs.getReasons();
    },

    getTransaction: (_, args, context) => {
      const { transactionDs } = context.dataSources;
      return transactionDs.getTransaction(args);
    },

    getTransactions: (_, args, context) => {
      const { transactionDs } = context.dataSources;
      return transactionDs.getTransactions(args);
    },
  },

  Transaction: {
    /**
     * Prisma will resolve the n+1 problem. Don't need DataLoader lib.
     */
    reason: async (trans, _, context) => {
      const { reasonDs } = context.dataSources;
      const reason = await reasonDs.getReasonById(trans.reasonId);

      if (!reason) {
        throw new ApolloError(`Reason with ID = ${trans.reasonId} doesn't exist.`);
      }

      return reason;
    },
  },

  Mutation: {
    createTransaction: async (_, args, context) => {
      const { reasonDs, transactionDs } = context.dataSources;

      let reason = await reasonDs.getReasonByText(args.reasonText);

      if (!reason) {
        reason = await reasonDs.createReason({ text: args.reasonText });
      }

      return transactionDs.createTransaction({ ...args, reasonId: reason.id });
    },

    updateTransaction: async (_, args, context) => {
      const { reasonDs, transactionDs } = context.dataSources;

      let reasonId: number | undefined = undefined;
      if (args.reasonText) {
        let reason = await reasonDs.getReasonByText(args.reasonText);

        if (!reason) {
          reason = await reasonDs.createReason({ text: args.reasonText });
        }

        reasonId = reason.id;
      }

      return transactionDs.updateTransaction({ ...args, reasonId });
    },

    deleteTransaction: async (_, args, context) => {
      const { transactionDs } = context.dataSources;

      await transactionDs.deleteTransaction(args);

      return true;
    },

    createReason: (_, args, context) => {
      const { reasonDs } = context.dataSources;

      return reasonDs.createReason(args);
    },

    updateReason: (_, args, context) => {
      const { reasonDs } = context.dataSources;

      return reasonDs.updateReason(args);
    },
  },
};
