import { RiskType } from '@prisma/client';

export type NegativeResponseJob = {
  guardeeId: string;
  riskType: RiskType;
  responseEventId: string;
};
