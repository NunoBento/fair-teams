import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { PlayersModule } from '../players/players.module';
import { GameMatch, GameMatchSchema } from './match.schema';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameMatch.name, schema: GameMatchSchema },
    ]),
    AuthModule,
    PlayersModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}
