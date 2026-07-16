export interface UserEvent<TPayload = unknown> {
  eventId: string;
  userId: string;
  sequence: number;
  eventType: string;
  occurredAt: string;
  payload: TPayload;
}

export type UserEventHandler = (event: UserEvent) => Promise<void>;
