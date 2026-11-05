import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PlayersModule } from './players/players.module';
import { TeamsModule } from './teams/teams.module';

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		MongooseModule.forRoot(
			process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/fiveaside',
		),
		AuthModule,
		PlayersModule,
		TeamsModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule { }
