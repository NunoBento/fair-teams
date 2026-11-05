import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { PlayerStats } from './player-stats';

@Schema({ _id: false })
export class PlayerRating {
  @Prop({ required: true, trim: true, maxlength: 60 })
  evaluatorName!: string;

  @Prop()
  evaluatorUserId?: string;

  @Prop({ type: Object, required: true })
  stats!: PlayerStats;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export const PlayerRatingSchema = SchemaFactory.createForClass(PlayerRating);

@Schema({ timestamps: true })
export class Player {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 60 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 30, default: 'Any' })
  position!: string;

  @Prop({ type: [PlayerRatingSchema], default: [] })
  ratings!: PlayerRating[];
}

export type PlayerDocument = HydratedDocument<Player>;
export const PlayerSchema = SchemaFactory.createForClass(Player);
