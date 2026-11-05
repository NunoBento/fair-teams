import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MatchTeam = 'whites' | 'blacks';

@Schema({ _id: false })
export class MatchPlayer {
  @Prop({ required: true })
  playerId!: string;

  @Prop({ required: true, trim: true })
  playerName!: string;
}

export const MatchPlayerSchema = SchemaFactory.createForClass(MatchPlayer);

@Schema({ _id: false })
export class MatchSide {
  @Prop({ type: [MatchPlayerSchema], required: true })
  players!: MatchPlayer[];
}

export const MatchSideSchema = SchemaFactory.createForClass(MatchSide);

@Schema()
export class MatchGoal {
  @Prop({ required: true, enum: ['whites', 'blacks'] })
  team!: MatchTeam;

  @Prop({ required: true })
  playerId!: string;

  @Prop({ required: true, trim: true })
  playerName!: string;

  @Prop({ required: true, default: Date.now })
  scoredAt!: Date;

  @Prop({ required: true })
  scoredByUserId!: string;
}

export const MatchGoalSchema = SchemaFactory.createForClass(MatchGoal);

@Schema({ timestamps: true })
export class GameMatch {
  @Prop({ required: true, default: Date.now })
  gameDate!: Date;

  @Prop({ required: true, enum: ['live', 'completed'], default: 'live' })
  status!: 'live' | 'completed';

  @Prop({ type: MatchSideSchema, required: true })
  whites!: MatchSide;

  @Prop({ type: MatchSideSchema, required: true })
  blacks!: MatchSide;

  @Prop({ type: [MatchGoalSchema], default: [] })
  goals!: Array<MatchGoal & { _id: Types.ObjectId }>;

  @Prop({ required: true })
  startedByUserId!: string;

  @Prop()
  finishedAt?: Date;
}

export type GameMatchDocument = HydratedDocument<GameMatch>;
export const GameMatchSchema = SchemaFactory.createForClass(GameMatch);
GameMatchSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'live' } },
);
