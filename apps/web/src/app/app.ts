import { DecimalPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, of } from 'rxjs';

const SKILLS = ['dribbling', 'speed', 'shooting', 'stamina', 'passing', 'defending'] as const;
type Skill = (typeof SKILLS)[number];
type PlayerStats = Record<Skill, number | null>;
type RatingStats = Record<Skill, number>;

interface Player {
	id: string;
	name: string;
	ratingCount: number;
	stats: PlayerStats;
}

interface Team {
	name: string;
	players: Player[];
	average: number;
}

type MatchTeam = 'whites' | 'blacks';

interface MatchPlayer {
	playerId: string;
	playerName: string;
}

interface MatchGoal {
	id: string;
	team: MatchTeam;
	playerId: string;
	playerName: string;
	scoredAt: string;
}

interface GameMatch {
	id: string;
	gameDate: string;
	status: 'live' | 'completed';
	teams: Record<MatchTeam, { players: MatchPlayer[] }>;
	goals: MatchGoal[];
	finishedAt?: string;
}

interface GoalLeader {
	playerId: string;
	playerName: string;
	goals: number;
}

interface SessionUser {
	id: string;
	username: string;
	role: 'admin' | 'member';
	playerId?: string;
}

interface MemberAccount {
	id: string;
	username: string;
	role: 'member';
	playerId?: string;
}

@Component({
	selector: 'app-root',
	imports: [DecimalPipe, FormsModule],
	template: `
    @if (!sessionUser) {
      <main class="login-page">
        <a class="brand login-brand" href="#" aria-label="Fiveaside home">
          <span class="brand-mark">5</span>
          <span>fiveaside<span class="brand-period">.</span></span>
        </a>
        <form class="login-card" (ngSubmit)="login()">
          <div class="section-kicker">THURSDAY LEAGUE</div>
          <h1>Welcome back.</h1>
          <p>Sign in to see the squad and rate your teammates.</p>
          @if (loginError) { <div class="error-banner" role="alert">{{ loginError }}</div> }
          <label class="form-field">Username<input name="username" autocomplete="username" [(ngModel)]="loginUsername" required /></label>
          <label class="form-field">Password<input name="password" type="password" autocomplete="current-password" [(ngModel)]="loginPassword" required /></label>
          <button class="build-button modal-submit" type="submit" [disabled]="loginBusy || !loginUsername || !loginPassword">
            {{ loginBusy ? 'Signing in…' : 'Sign in' }} <span>→</span>
          </button>
        </form>
        <p class="login-caption">Your league, your game.</p>
      </main>
    } @else {
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="#" aria-label="Fiveaside home">
          <span class="brand-mark">5</span>
          <span>fiveaside<span class="brand-period">.</span></span>
        </a>
        <div class="side-label">Workspace</div>
        <nav class="navigation" aria-label="Main navigation">
          <button class="nav-item" [class.active]="currentPage === 'dashboard'" (click)="showDashboard()"><span class="nav-icon">◫</span> Dashboard</button>
          <button class="nav-item" [class.active]="currentPage === 'match'" (click)="showMatchPage()"><span class="nav-icon">⚽</span> Live match</button>
          <button class="nav-item" (click)="goToPlayers()"><span class="nav-icon">◎</span> Players <span class="nav-count">{{ players.length }}</span></button>
          <button class="nav-item" (click)="goToTeamBuilder()"><span class="nav-icon">⌘</span> Team builder</button>
          @if (isAdmin) {
            <button class="nav-item" (click)="openUserManagement()"><span class="nav-icon">♙</span> Members <span class="nav-count">{{ memberAccounts.length }}</span></button>
          }
        </nav>
        <div class="sidebar-bottom">
          <div class="league-card">
            <div class="league-icon">⚽</div>
            <div><strong>Thursday league</strong><span>Weekly · 5-a-side</span></div>
            <span class="league-dot"></span>
          </div>
          <div class="profile-button">
            <span class="profile-avatar">{{ initials(sessionUser.username) }}</span>
            <span class="profile-copy"><strong>{{ sessionUser.username }}</strong><span>{{ isAdmin ? 'League admin' : 'League member' }}</span></span>
            <button class="sign-out-button" (click)="logout()" aria-label="Sign out">↪</button>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <header class="topbar">
          <div class="breadcrumb">Thursday league <span>/</span> <strong>{{ currentPage === 'match' ? 'Live match' : 'Overview' }}</strong></div>
          <div class="top-actions">
            <div class="week-chip"><span class="live-dot"></span> Weekly match <span class="chip-divider"></span> Thu · 21:00</div>
            <span class="top-avatar">{{ initials(sessionUser.username) }}</span>
          </div>
        </header>

        <div class="content">
          @if (errorMessage) {
            <div class="error-banner" role="alert">{{ errorMessage }}</div>
          }

          @if (currentPage === 'dashboard') {
          <section class="welcome-row">
            <div>
              <div class="eyebrow"><span class="eyebrow-line"></span> YOUR LEAGUE AT A GLANCE</div>
              <h1>Know your players.<br /><span>Build fair teams.</span></h1>
              <p class="welcome-copy">Rate the squad and get ready for Thursday futsal.</p>
            </div>
          </section>

          <section class="stats-row" aria-label="League overview">
            <article class="stat-card">
              <div class="stat-top"><span class="stat-label">PLAYERS</span><span class="stat-icon green-icon">♙</span></div>
              <div class="stat-value">{{ players.length }}</div>
              <div class="stat-foot"><span>In your league roster</span></div>
            </article>
            <article class="stat-card">
              <div class="stat-top"><span class="stat-label">PLAYER RATINGS</span><span class="stat-icon blue-icon">◈</span></div>
              <div class="stat-value">{{ totalRatings }}</div>
              <div class="stat-foot"><span>Ratings submitted by league members</span></div>
            </article>
          </section>

          <section class="dashboard-grid">
            <article class="panel roster-panel" id="players">
              <div class="panel-heading">
                <div><div class="section-kicker">THE LINE-UP</div><h2>Player roster <span class="heading-count">{{ players.length }}</span></h2></div>
                <div class="panel-actions"><label class="search-box"><span>⌕</span><input aria-label="Search players" placeholder="Search players..." [(ngModel)]="searchTerm" /></label>@if (isAdmin) { <button class="add-button" (click)="openAddPlayer()">＋ <span>Add player</span></button> }</div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>SELECT</th><th>PLAYER</th><th>DRIBBLE</th><th>SPEED</th><th>SHOOTING</th><th>STAMINA</th><th>PASSING</th><th>DEFENCE</th><th>REVIEWS</th><th></th></tr></thead>
                  <tbody>
                    @for (player of filteredPlayers; track player.id; let i = $index) {
                      <tr>
                        <td><input class="team-select-checkbox" type="checkbox" [checked]="isPlayerSelected(player)" [disabled]="!player.ratingCount" [attr.aria-label]="'Select ' + player.name + ' for teams'" (change)="togglePlayer(player, $event)" /></td>
                        <td><div class="player-name-cell"><span class="player-avatar avatar-{{ i % 6 }}">{{ initials(player.name) }}</span><strong>{{ player.name }}</strong></div></td>
                        @for (skill of skills; track skill) {
                          <td><span class="rating-value" [class.rating-indicator]="player.stats[skill] !== null" [class.rating-muted]="player.stats[skill] === null" [style.--rating-hue]="(player.stats[skill] ?? 0) * 12">{{ formatScore(player.stats[skill]) }}</span></td>
                        }
                        <td><span class="review-count">{{ player.ratingCount }} <span>reviews</span></span></td>
                        <td class="row-actions">
                          <button class="row-menu" [disabled]="isOwnPlayer(player)" [attr.aria-label]="isOwnPlayer(player) ? 'Your player profile' : 'Rate ' + player.name" (click)="openRating(player)">{{ isOwnPlayer(player) ? 'You' : 'Rate' }}</button>
                          @if (isAdmin) { <button class="row-delete" [attr.aria-label]="'Delete ' + player.name" (click)="openDelete(player)">⌫</button> }
                        </td>
                      </tr>
                    } @empty {
                      <tr><td class="empty-row" colspan="10">No players match your search.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="table-footer"><span>Showing <strong>{{ filteredPlayers.length }}</strong> of <strong>{{ players.length }}</strong> players <i>·</i> <strong>{{ selectedPlayerIds.length }}</strong> selected for teams</span></div>
            </article>

            <aside class="panel skills-panel">
              <div class="skills-heading"><div><div class="section-kicker">LEAGUE SNAPSHOT</div><h2>Skill averages</h2></div></div>
              <p class="panel-subtitle">Median ratings across all players</p>
              <div class="skill-list">
                @for (skill of skills; track skill) {
                  <div class="skill-row">
                    <div class="skill-label"><span>{{ skillLabel(skill) }}</span><strong>{{ formatScore(leagueMedian(skill)) }}<small>/10</small></strong></div>
                    <div class="skill-track"><span class="skill-fill fill-{{ $index }}" [style.width.%]="(leagueMedian(skill) ?? 0) * 10"></span></div>
                  </div>
                }
              </div>
            </aside>
          </section>

          <section class="panel builder-panel" id="team-builder">
            <div class="builder-header">
              <div class="builder-copy">
                <div class="builder-icon">✳</div>
                <div><div class="section-kicker">MATCH DAY, MADE FAIR</div><h2>Build your teams</h2><p>Choose your players and create two balanced sides.</p></div>
              </div>
              <div class="builder-controls">
                <label class="select-wrap"><span>FORMAT</span><select [(ngModel)]="selectedCount"><option [ngValue]="10">10 players · 5v5</option><option [ngValue]="8">8 players · 4v4</option></select></label>
                <button class="build-button" (click)="generateTeams()">✨ <span>{{ teams.length ? 'Regenerate teams' : 'Build teams' }}</span></button>
              </div>
            </div>
            @if (teams.length) {
              <div class="swap-hint"><span>↔</span> Want to make a change? Select one player from each team to swap them.</div>
              <div class="teams-result">
                @for (team of teams; track team.name; let i = $index) {
                  <div class="team-result-card" [class.team-a-card]="i === 0" [class.team-b-card]="i === 1">
                    <div class="result-team-heading">
                      <span class="team-badge" [class.badge-lime]="i === 0" [class.badge-purple]="i === 1">{{ i === 0 ? 'A' : 'B' }}</span>
                      <div class="result-team-title"><strong>Team {{ i === 0 ? 'A' : 'B' }}</strong><small>{{ team.players.length }} players</small></div>
                      <div class="team-average" [style.--rating-hue]="team.average * 12">
                        <strong>{{ team.average | number:'1.1-1' }}</strong><small>avg / 10</small>
                      </div>
                    </div>
                    <svg class="radar-chart team-radar-chart" viewBox="0 0 220 205" role="img" [attr.aria-label]="'Team ' + (i === 0 ? 'A' : 'B') + ' skill ratings radar chart'">
                      <polygon class="radar-grid" [attr.points]="radarGridPoints(10)" />
                      <polygon class="radar-grid radar-grid-inner" [attr.points]="radarGridPoints(5)" />
                      @for (skill of skills; track skill; let axis = $index) {
                        <line class="radar-axis" x1="110" y1="103" [attr.x2]="radarAxisPoint(axis).x" [attr.y2]="radarAxisPoint(axis).y" />
                      }
                      <polygon class="radar-data" [class.radar-data-team-a]="i === 0" [class.radar-data-team-b]="i === 1" [attr.points]="radarPoints(teamRadarStats(team))" />
                      <text class="radar-label" x="110" y="13" text-anchor="middle">Dribbling</text>
                      <text class="radar-label" x="185" y="57" text-anchor="start">Speed</text>
                      <text class="radar-label" x="185" y="157" text-anchor="start">Shooting</text>
                      <text class="radar-label" x="110" y="201" text-anchor="middle">Stamina</text>
                      <text class="radar-label" x="35" y="157" text-anchor="end">Passing</text>
                      <text class="radar-label" x="35" y="57" text-anchor="end">Defending</text>
                    </svg>
                    <div class="team-skill-averages" aria-label="Team skill averages">
                      @for (skill of skills; track skill) {
                        <div
                          class="team-skill-average"
                          [style.--rating-hue]="(teamSkillAverage(team, skill) ?? 0) * 12"
                        >
                          <span>{{ skillLabel(skill) }}</span>
                          <strong>{{ formatScore(teamSkillAverage(team, skill)) }}</strong>
                        </div>
                      }
                    </div>
                    <div class="team-player-list">
                      @for (player of team.players; track player.id) {
                        <button
                          type="button"
                          class="team-player"
                          [class.swap-selected]="swapPlayerId === player.id"
                          [attr.aria-label]="swapPlayerId === player.id ? player.name + ' selected for swap' : swapPlayerId ? 'Swap ' + player.name + ' with ' + swapPlayerName() : 'Select ' + player.name + ' to swap'"
                          (click)="selectTeamPlayerForSwap(team, player)"
                        >
                          <span class="team-player-avatar">{{ initials(player.name) }}</span>
                          <span class="team-player-name">{{ player.name }}</span>
                          <span class="swap-action">{{ swapPlayerId === player.id ? 'Selected' : swapPlayerId ? 'Swap' : '↔' }}</span>
                        </button>
                      }
                    </div>
                  </div>
                }
                <div class="balance-result"><span class="balance-result-icon">⚖</span><div><strong>Average skill gap</strong><span>{{ balanceGap | number:'1.1-1' }} points between teams</span></div></div>
                </div>
                <section class="whatsapp-share" aria-labelledby="whatsapp-title">
                  <div class="whatsapp-share-header">
                    <div><div class="section-kicker">READY TO SHARE</div><h3 id="whatsapp-title">Match message</h3></div>
                    <button class="copy-teams-button" type="button" (click)="copyTeamsMessage()">
                      {{ teamsMessageCopied ? 'Copied!' : 'Copy message' }}
                    </button>
                  </div>
                  <pre class="whatsapp-message">{{ teamsWhatsAppMessage() }}</pre>
                  @if (teamsMessageError) { <p class="whatsapp-copy-error" role="alert">{{ teamsMessageError }}</p> }
                  @else if (teamsMessageCopied) { <p class="whatsapp-copy-success" role="status">Message copied. Paste it into your WhatsApp group.</p> }
                </section>
            }
          </section>

          <footer class="page-footer"><span>fiveaside<span class="brand-period">.</span> <span>Built for the love of the game.</span></span><span>Thursday league <i>·</i> Weekly at 21:00</span></footer>
          } @else {
          <section class="match-page">
            <header class="match-page-heading">
              <div>
                <div class="section-kicker">THURSDAY LEAGUE · LIVE SCOREKEEPER</div>
                <h1>Brancos <span>vs</span> Pretos</h1>
                <p>Track every goal and choose who scored. Goals save automatically.</p>
              </div>
              @if (activeMatch) { <span class="match-live-badge"><i></i> LIVE</span> }
            </header>
            @if (matchNotice) { <div class="match-notice" role="status">{{ matchNotice }}</div> }
            @if (matchError) { <div class="error-banner" role="alert">{{ matchError }}</div> }
            @if (matchLoading) {
              <div class="panel match-empty-state" role="status">Loading match data…</div>
            } @else if (activeMatch) {
              <section class="match-scoreboard" aria-label="Live match score">
                <div class="score-team score-whites">
                  <span class="score-team-name">BRANCOS</span>
                  <strong>{{ matchScore(activeMatch, 'whites') }}</strong>
                </div>
                <div class="score-status">
                  <span class="score-vs">VS</span>
                  <strong
                    [class.white-leading]="matchScore(activeMatch, 'whites') > matchScore(activeMatch, 'blacks')"
                    [class.black-leading]="matchScore(activeMatch, 'blacks') > matchScore(activeMatch, 'whites')"
                  >{{ matchLead(activeMatch) }}</strong>
                  <small>{{ formatGameDate(activeMatch.gameDate) }}</small>
                </div>
                <div class="score-team score-blacks">
                  <span class="score-team-name">PRETOS</span>
                  <strong>{{ matchScore(activeMatch, 'blacks') }}</strong>
                </div>
              </section>
              <section class="match-rosters" aria-label="Match teams and scorers">
                <article class="scoring-panel scoring-whites">
                  <header><span class="score-team-dot"></span><h2>Brancos</h2><small>{{ activeMatch.teams.whites.players.length }} players</small></header>
                  <label class="form-field">Who scored?
                    <select name="whiteScorer" [(ngModel)]="selectedWhiteScorerId">
                      @for (player of activeMatch.teams.whites.players; track player.playerId) { <option [value]="player.playerId">{{ player.playerName }}</option> }
                    </select>
                  </label>
                  <button class="goal-button goal-white-button" type="button" (click)="addMatchGoal('whites')" [disabled]="matchSaving || !activeMatch.teams.whites.players.length">＋ Add Brancos goal</button>
                  <div class="roster-list">
                    @for (player of activeMatch.teams.whites.players; track player.playerId) {
                      <div class="roster-row"><span>{{ player.playerName }}</span><strong>{{ playerGoalCount(activeMatch, player.playerId) }}</strong></div>
                    }
                  </div>
                </article>
                <article class="scoring-panel scoring-blacks">
                  <header><span class="score-team-dot"></span><h2>Pretos</h2><small>{{ activeMatch.teams.blacks.players.length }} players</small></header>
                  <label class="form-field">Who scored?
                    <select name="blackScorer" [(ngModel)]="selectedBlackScorerId">
                      @for (player of activeMatch.teams.blacks.players; track player.playerId) { <option [value]="player.playerId">{{ player.playerName }}</option> }
                    </select>
                  </label>
                  <button class="goal-button goal-black-button" type="button" (click)="addMatchGoal('blacks')" [disabled]="matchSaving || !activeMatch.teams.blacks.players.length">＋ Add Pretos goal</button>
                  <div class="roster-list">
                    @for (player of activeMatch.teams.blacks.players; track player.playerId) {
                      <div class="roster-row"><span>{{ player.playerName }}</span><strong>{{ playerGoalCount(activeMatch, player.playerId) }}</strong></div>
                    }
                  </div>
                </article>
              </section>
              <section class="panel match-goals-panel">
                <div class="panel-heading match-goals-heading"><div><div class="section-kicker">MATCH TIMELINE</div><h2>Goals <span class="heading-count">{{ activeMatch.goals.length }}</span></h2></div>
                  <button class="finish-match-button" type="button" (click)="finishMatch()" [disabled]="matchSaving">{{ matchSaving ? 'Saving…' : 'Finish game' }}</button>
                </div>
                <div class="match-goal-list">
                  @for (goal of activeMatch.goals; track goal.id; let i = $index) {
                    <div class="match-goal-row" [class.goal-row-black]="goal.team === 'blacks'">
                      <span class="goal-number">{{ i + 1 }}</span><span class="goal-team-tag">{{ goal.team === 'whites' ? 'BRANCOS' : 'PRETOS' }}</span>
                      <strong>{{ goal.playerName }}</strong><time>{{ formatGoalTime(goal.scoredAt) }}</time>
                    </div>
                  } @empty {
                    <p class="match-empty-state">No goals yet. Add the first goal above.</p>
                  }
                </div>
              </section>
            } @else {
              <section class="panel start-match-panel">
                <div class="start-match-icon">⚽</div>
                <div class="section-kicker">READY WHEN YOU ARE</div>
                <h2>Start a new game</h2>
                @if (teams.length === 2) {
                  <p>Team A will play as Brancos and Team B as Pretos. You can change players in the team builder before starting.</p>
                  <div class="start-team-preview">
                    <div><strong>Brancos</strong><span>{{ teamPlayerNames(teams[0]) }}</span></div>
                    <div><strong>Pretos</strong><span>{{ teamPlayerNames(teams[1]) }}</span></div>
                  </div>
                  <button class="build-button start-match-button" type="button" (click)="startMatch()" [disabled]="matchSaving">
                    {{ matchSaving ? 'Starting…' : 'Start live game' }} <span>→</span>
                  </button>
                } @else {
                  <p>Build balanced teams first, then come back here to start keeping score.</p>
                  <button class="build-button start-match-button" type="button" (click)="goToTeamBuilder()">Go to team builder <span>→</span></button>
                }
              </section>
            }
            <section class="match-stats-grid">
              <article class="panel match-stats-panel">
                <div class="section-kicker">ALL-TIME STATS</div><h2>Goals by player</h2>
                <div class="leader-list">
                  @for (leader of goalLeaders; track leader.playerId; let i = $index) {
                    <div class="leader-row"><span class="leader-rank">{{ i + 1 }}</span><strong>{{ leader.playerName }}</strong><span>{{ leader.goals }} {{ leader.goals === 1 ? 'goal' : 'goals' }}</span></div>
                  } @empty { <p class="match-muted">Player goal totals will appear here.</p> }
                </div>
              </article>
              <article class="panel match-stats-panel">
                <div class="section-kicker">RECENT RESULTS</div><h2>Match history</h2>
                <div class="history-list">
                  @for (match of recentMatches; track match.id) {
                    <div class="history-row">
                      <time>{{ formatGameDate(match.gameDate) }}</time>
                      <strong class="history-score"><span>{{ matchScore(match, 'whites') }}</span><small>–</small><span>{{ matchScore(match, 'blacks') }}</span></strong>
                      <span class="history-winner">{{ matchLead(match) }}</span>
                    </div>
                  } @empty { <p class="match-muted">Finished games will be saved here.</p> }
                </div>
              </article>
            </section>
          </section>
          }
        </div>
      </main>
    </div>

    @if (modal === 'player') {
      <div class="modal-backdrop" (click)="closeModal()">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" (click)="$event.stopPropagation()">
          <button class="modal-close" aria-label="Close" (click)="closeModal()">×</button>
          <div class="section-kicker">GROW THE ROSTER</div><h2 id="modal-title">Add a player</h2><p>Bring another player into your Thursday league.</p>
          <label class="form-field">Player name<input [(ngModel)]="newPlayerName" placeholder="e.g. Alex Morgan" /></label>
          <button class="build-button modal-submit" (click)="addPlayer()" [disabled]="!newPlayerName.trim()">Add to roster <span>→</span></button>
        </section>
      </div>
    }

    @if (modal === 'rating' && selectedPlayer) {
      <div class="modal-backdrop" (click)="closeModal()">
        <section class="modal-card rating-modal" role="dialog" aria-modal="true" aria-labelledby="rating-title" (click)="$event.stopPropagation()">
          <button class="modal-close" aria-label="Close" (click)="closeModal()">×</button>
          <div class="section-kicker">PEER REVIEW</div><h2 id="rating-title">Rate {{ selectedPlayer.name }}</h2><p>Give an honest 1–10 rating for each skill.</p>
          @if (ratingLoading) { <p class="rating-load-status" role="status">Loading your previous rating…</p> }
          @if (ratingLoadError) {
            <div class="error-banner modal-error" role="alert">{{ ratingLoadError }}</div>
            <button class="cancel-button rating-retry" (click)="openRating(selectedPlayer)">Try again</button>
          }
          <svg class="radar-chart rating-radar-chart" viewBox="0 0 220 205" role="img" aria-label="Player skill ratings radar chart">
            <polygon class="radar-grid" [attr.points]="radarGridPoints(10)" />
            <polygon class="radar-grid radar-grid-inner" [attr.points]="radarGridPoints(5)" />
            @for (skill of skills; track skill; let axis = $index) {
              <line class="radar-axis" x1="110" y1="103" [attr.x2]="radarAxisPoint(axis).x" [attr.y2]="radarAxisPoint(axis).y" />
            }
            <polygon class="radar-data radar-data-rating" [attr.points]="radarPoints(ratingDraft)" />
            @for (skill of skills; track skill; let axis = $index) {
              <circle class="radar-point" [attr.cx]="radarVertex(ratingDraft, axis).x" [attr.cy]="radarVertex(ratingDraft, axis).y" r="3" />
            }
            <text class="radar-label" x="110" y="13" text-anchor="middle">Dribbling</text>
            <text class="radar-label" x="185" y="57" text-anchor="start">Speed</text>
            <text class="radar-label" x="185" y="157" text-anchor="start">Shooting</text>
            <text class="radar-label" x="110" y="201" text-anchor="middle">Stamina</text>
            <text class="radar-label" x="35" y="157" text-anchor="end">Passing</text>
            <text class="radar-label" x="35" y="57" text-anchor="end">Defending</text>
          </svg>
          <div class="rating-fields">@for (skill of skills; track skill) { <label class="rating-field"><span>{{ skillLabel(skill) }}</span><input type="range" min="1" max="10" step="1" [(ngModel)]="ratingDraft[skill]" [disabled]="ratingLoading || !!ratingLoadError" /><strong>{{ ratingDraft[skill] }}</strong></label> }</div>
          <button class="build-button modal-submit" (click)="saveRating()" [disabled]="ratingLoading || !!ratingLoadError">{{ ratingLoading ? 'Loading rating…' : 'Submit rating' }} <span>→</span></button>
        </section>
      </div>
    }

    @if (modal === 'delete' && selectedPlayer) {
      <div class="modal-backdrop" (click)="closeModal()">
        <section class="modal-card delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title" (click)="$event.stopPropagation()">
          <button class="modal-close" aria-label="Close" (click)="closeModal()" [disabled]="deletingPlayer">×</button>
          <div class="delete-icon">!</div>
          <div class="section-kicker">ROSTER ADMIN</div><h2 id="delete-title">Remove {{ selectedPlayer.name }}?</h2>
          <p>This will permanently remove this player and their ratings from the league.</p>
          @if (errorMessage) { <div class="error-banner modal-error" role="alert">{{ errorMessage }}</div> }
          <div class="delete-actions">
            <button class="cancel-button" (click)="closeModal()" [disabled]="deletingPlayer">Cancel</button>
            <button class="confirm-delete-button" (click)="deletePlayer()" [disabled]="deletingPlayer">
              {{ deletingPlayer ? 'Removing…' : 'Delete player' }}
            </button>
          </div>
        </section>
      </div>
    }
    @if (modal === 'users') {
      <div class="modal-backdrop" (click)="closeModal()">
        <section class="modal-card user-modal" role="dialog" aria-modal="true" aria-labelledby="users-title" (click)="$event.stopPropagation()">
          <button class="modal-close" aria-label="Close" (click)="closeModal()">×</button>
          <div class="section-kicker">LEAGUE ACCESS</div><h2 id="users-title">Manage members</h2>
          <p>Create a login for a player. Their generated password is shown only once.</p>
          @if (generatedCredentials) {
            <div class="credential-reveal" role="status">
              <strong>Share this temporary password now</strong>
              <span>Username: <b>{{ generatedCredentials.username }}</b></span>
              <code>{{ generatedCredentials.password }}</code>
              <button class="copy-button" (click)="copyPassword()">Copy password</button>
            </div>
          }
          @if (userAdminError) { <div class="error-banner modal-error" role="alert">{{ userAdminError }}</div> }
          <form class="create-user-form" (ngSubmit)="createMember()">
            <label class="form-field">Username<input name="memberUsername" [(ngModel)]="newUsername" autocomplete="off" minlength="3" maxlength="32" required /></label>
            <label class="form-field">Player profile
              <select name="memberPlayer" [(ngModel)]="newMemberPlayerId" required>
                <option value="" disabled>Select a player</option>
                @for (player of availablePlayers; track player.id) { <option [value]="player.id">{{ player.name }}</option> }
              </select>
            </label>
            @if (!availablePlayers.length) { <p class="no-available-players">All roster players already have accounts. Add another player before creating a login.</p> }
            <button class="build-button modal-submit" type="submit" [disabled]="creatingMember || !newUsername.trim() || !newMemberPlayerId">
              {{ creatingMember ? 'Creating account…' : 'Create account & generate password' }}
            </button>
          </form>
          <div class="members-list">
            <div class="members-list-heading">Current members <span>{{ memberAccounts.length }}</span></div>
            @for (member of memberAccounts; track member.id) {
              <div class="member-row">
                <span class="profile-avatar member-avatar">{{ initials(member.username) }}</span>
                <span class="member-info"><strong>{{ member.username }}</strong><small>{{ playerName(member.playerId) }}</small></span>
                <button class="remove-member-button" [attr.aria-label]="'Remove account ' + member.username" (click)="removeMember(member)">Remove</button>
              </div>
            } @empty {
              <p class="no-members">No member accounts yet.</p>
            }
          </div>
        </section>
      </div>
    }
    }
  `,
})
export class App implements OnInit {
	private readonly http = inject(HttpClient);
	private readonly changeDetector = inject(ChangeDetectorRef);
	readonly skills = SKILLS;
	sessionUser: SessionUser | null = null;
	loginUsername = '';
	loginPassword = '';
	loginError = '';
	loginBusy = false;
	players: Player[] = [];
	memberAccounts: MemberAccount[] = [];
	searchTerm = '';
	selectedCount = 10;
	selectedPlayerIds: string[] = [];
	errorMessage = '';
	userAdminError = '';
	modal: 'player' | 'rating' | 'delete' | 'users' | null = null;
	selectedPlayer: Player | null = null;
	deletingPlayer = false;
	creatingMember = false;
	newPlayerName = '';
	newUsername = '';
	newMemberPlayerId = '';
	generatedCredentials: { username: string; password: string } | null = null;
	ratingDraft: RatingStats = { dribbling: 5, speed: 5, shooting: 5, stamina: 5, passing: 5, defending: 5 };
	ratingLoading = false;
	ratingLoadError = '';
	private ratingRequestId = 0;
	teams: Team[] = [];
	balanceGap = 0;
	swapPlayerId: string | null = null;
	teamsMessageCopied = false;
	teamsMessageError = '';
	currentPage: 'dashboard' | 'match' = 'dashboard';
	activeMatch: GameMatch | null = null;
	recentMatches: GameMatch[] = [];
	goalLeaders: GoalLeader[] = [];
	matchLoading = false;
	matchSaving = false;
	matchError = '';
	matchNotice = '';
	selectedWhiteScorerId = '';
	selectedBlackScorerId = '';
	private matchRefreshTimer: ReturnType<typeof setInterval> | null = null;

	radarAxisPoint(index: number): { x: number; y: number } {
		const angle = (index * 60 - 90) * Math.PI / 180;
		return {
			x: Number((110 + Math.cos(angle) * 65).toFixed(1)),
			y: Number((103 + Math.sin(angle) * 65).toFixed(1)),
		};
	}

	radarVertex(stats: Readonly<Record<Skill, number | null>>, index: number): { x: number; y: number } {
		const angle = (index * 60 - 90) * Math.PI / 180;
		const radius = 65 * (stats[SKILLS[index]] ?? 0) / 10;
		return {
			x: Number((110 + Math.cos(angle) * radius).toFixed(1)),
			y: Number((103 + Math.sin(angle) * radius).toFixed(1)),
		};
	}

	radarGridPoints(score: 5 | 10): string {
		const radius = 65 * score / 10;
		return SKILLS.map((_, index) => {
			const angle = (index * 60 - 90) * Math.PI / 180;
			return `${(110 + Math.cos(angle) * radius).toFixed(1)},${(103 + Math.sin(angle) * radius).toFixed(1)}`;
		}).join(' ');
	}

	radarPoints(stats: Readonly<Record<Skill, number | null>>): string {
		return SKILLS.map((_, index) => {
			const point = this.radarVertex(stats, index);
			return `${point.x},${point.y}`;
		}).join(' ');
	}

	teamRadarStats(team: Team): Record<Skill, number | null> {
		return {
			dribbling: this.teamSkillAverage(team, 'dribbling'),
			speed: this.teamSkillAverage(team, 'speed'),
			shooting: this.teamSkillAverage(team, 'shooting'),
			stamina: this.teamSkillAverage(team, 'stamina'),
			passing: this.teamSkillAverage(team, 'passing'),
			defending: this.teamSkillAverage(team, 'defending'),
		};
	}

	showDashboard(): void {
		this.currentPage = 'dashboard';
		this.clearMatchRefresh();
	}

	goToTeamBuilder(): void {
		this.showDashboard();
		setTimeout(() => this.scrollToTeamBuilder());
	}

	goToPlayers(): void {
		this.showDashboard();
		setTimeout(() => this.scrollToPlayers());
	}

	showMatchPage(): void {
		this.currentPage = 'match';
		this.matchNotice = '';
		this.clearMatchRefresh();
		void this.loadMatchPage();
		this.matchRefreshTimer = setInterval(() => {
			void this.refreshActiveMatch();
		}, 5000);
	}

	private clearMatchRefresh(): void {
		if (this.matchRefreshTimer !== null) {
			clearInterval(this.matchRefreshTimer);
			this.matchRefreshTimer = null;
		}
	}

	private async loadMatchPage(): Promise<void> {
		this.matchLoading = true;
		this.matchError = '';
		try {
			const [active, recent, leaders] = await Promise.all([
				firstValueFrom(this.http.get<GameMatch | null>('/api/matches/active')),
				firstValueFrom(this.http.get<GameMatch[]>('/api/matches/recent')),
				firstValueFrom(this.http.get<GoalLeader[]>('/api/matches/goal-leaders')),
			]);
			this.activeMatch = active;
			this.recentMatches = recent;
			this.goalLeaders = leaders;
			this.syncSelectedScorers(active);
		} catch (error) {
			this.matchError = this.matchRequestError(error);
		} finally {
			this.matchLoading = false;
			this.changeDetector.detectChanges();
		}
	}

	private async refreshActiveMatch(): Promise<void> {
		if (this.currentPage !== 'match' || this.matchSaving || this.matchLoading) return;
		try {
			const previousMatchId = this.activeMatch?.id ?? null;
			const active = await firstValueFrom(this.http.get<GameMatch | null>('/api/matches/active'));
			this.activeMatch = active;
			this.syncSelectedScorers(active);
			if (previousMatchId && !active) await this.refreshMatchRecords();
			this.changeDetector.detectChanges();
		} catch (error) {
			this.matchError = this.matchRequestError(error);
			this.changeDetector.detectChanges();
		}
	}

	private syncSelectedScorers(match: GameMatch | null): void {
		if (!match) {
			this.selectedWhiteScorerId = '';
			this.selectedBlackScorerId = '';
			return;
		}
		if (!match.teams.whites.players.some((player) => player.playerId === this.selectedWhiteScorerId)) {
			this.selectedWhiteScorerId = match.teams.whites.players[0]?.playerId ?? '';
		}
		if (!match.teams.blacks.players.some((player) => player.playerId === this.selectedBlackScorerId)) {
			this.selectedBlackScorerId = match.teams.blacks.players[0]?.playerId ?? '';
		}
	}

	private async refreshMatchRecords(): Promise<void> {
		const [recent, leaders] = await Promise.all([
			firstValueFrom(this.http.get<GameMatch[]>('/api/matches/recent')),
			firstValueFrom(this.http.get<GoalLeader[]>('/api/matches/goal-leaders')),
		]);
		this.recentMatches = recent;
		this.goalLeaders = leaders;
	}

	async startMatch(): Promise<void> {
		if (this.matchSaving || this.activeMatch || this.teams.length !== 2) return;
		this.matchSaving = true;
		this.matchError = '';
		this.matchNotice = '';
		try {
			this.activeMatch = await firstValueFrom(this.http.post<GameMatch>('/api/matches', {
				whites: this.teams[0].players.map((player) => player.id),
				blacks: this.teams[1].players.map((player) => player.id),
			}));
			this.syncSelectedScorers(this.activeMatch);
		} catch (error) {
			this.matchError = this.matchRequestError(error);
		} finally {
			this.matchSaving = false;
			this.changeDetector.detectChanges();
		}
	}

	async addMatchGoal(team: MatchTeam): Promise<void> {
		if (!this.activeMatch || this.matchSaving) return;
		const playerId = team === 'whites' ? this.selectedWhiteScorerId : this.selectedBlackScorerId;
		if (!playerId) {
			this.matchError = 'Select the player who scored before adding the goal.';
			return;
		}
		this.matchSaving = true;
		this.matchError = '';
		try {
			this.activeMatch = await firstValueFrom(this.http.post<GameMatch>(
				`/api/matches/${this.activeMatch.id}/goals`,
				{ team, playerId },
			));
		} catch (error) {
			this.matchError = this.matchRequestError(error);
		} finally {
			this.matchSaving = false;
			this.changeDetector.detectChanges();
		}
	}

	async finishMatch(): Promise<void> {
		if (!this.activeMatch || this.matchSaving) return;
		if (!confirm('Finish this game? The final score and goal scorers will be saved to match history.')) return;
		this.matchSaving = true;
		this.matchError = '';
		try {
			await firstValueFrom(this.http.post<GameMatch>(`/api/matches/${this.activeMatch.id}/finish`, {}));
			this.activeMatch = null;
			this.selectedWhiteScorerId = '';
			this.selectedBlackScorerId = '';
			this.matchNotice = 'Game finished and saved. Player goal totals have been updated.';
			await this.refreshMatchRecords();
		} catch (error) {
			this.matchError = this.matchRequestError(error);
		} finally {
			this.matchSaving = false;
			this.changeDetector.detectChanges();
		}
	}

	matchScore(match: GameMatch, team: MatchTeam): number {
		return match.goals.filter((goal) => goal.team === team).length;
	}

	matchLead(match: GameMatch): string {
		const whiteScore = this.matchScore(match, 'whites');
		const blackScore = this.matchScore(match, 'blacks');
		if (whiteScore === blackScore) return 'EMPATE';
		return whiteScore > blackScore ? 'BRANCOS À FRENTE' : 'PRETOS À FRENTE';
	}

	playerGoalCount(match: GameMatch, playerId: string): number {
		return match.goals.filter((goal) => goal.playerId === playerId).length;
	}

	teamPlayerNames(team: Team): string {
		return team.players.map((player) => player.name).join(' · ');
	}

	formatGameDate(value: string): string {
		return new Date(value).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	formatGoalTime(value: string): string {
		return new Date(value).toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	private matchRequestError(error: unknown): string {
		if (error instanceof HttpErrorResponse && error.status === 401) {
			this.showApiError(error);
			return 'Your session expired. Please sign in again.';
		}
		if (error instanceof HttpErrorResponse && error.status === 409) {
			return error.error?.message ?? 'There is already a live game, or this game has finished.';
		}
		if (error instanceof HttpErrorResponse && error.status === 400) {
			return error.error?.message ?? 'The selected teams or scorer are not valid.';
		}
		return 'Could not save the game. Check your connection and try again.';
	}

	ngOnInit(): void {
		this.http.get<SessionUser>('/api/auth/me').pipe(
			catchError(() => of(null)),
		).subscribe((user) => {
			if (!user) return;
			this.sessionUser = user;
			this.changeDetector.detectChanges();
			void this.loadDashboard();
		});
	}

	get isAdmin(): boolean {
		return this.sessionUser?.role === 'admin';
	}

	get availablePlayers(): Player[] {
		const linkedPlayerIds = new Set(this.memberAccounts.map((member) => member.playerId));
		return this.players.filter((player) => !linkedPlayerIds.has(player.id));
	}

	get filteredPlayers(): Player[] {
		const query = this.searchTerm.trim().toLowerCase();
		return this.players.filter((player) => player.name.toLowerCase().includes(query));
	}

	get totalRatings(): number {
		return this.players.reduce((total, player) => total + player.ratingCount, 0);
	}

	initials(name: string): string {
		return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
	}

	formatScore(score: number | null): string {
		return score === null ? '—' : score.toFixed(1);
	}

	swapPlayerName(): string {
		return this.teams
			.flatMap((team) => team.players)
			.find((player) => player.id === this.swapPlayerId)?.name ?? 'selected player';
	}

	selectTeamPlayerForSwap(team: Team, player: Player): void {
		if (!this.swapPlayerId) {
			this.swapPlayerId = player.id;
			return;
		}

		if (this.swapPlayerId === player.id) {
			this.swapPlayerId = null;
			return;
		}

		const selectedTeamIndex = this.teams.findIndex((candidate) =>
			candidate.players.some((candidatePlayer) => candidatePlayer.id === this.swapPlayerId),
		);
		const targetTeamIndex = this.teams.indexOf(team);
		if (selectedTeamIndex === -1 || targetTeamIndex === -1) {
			this.swapPlayerId = null;
			return;
		}
		if (selectedTeamIndex === targetTeamIndex) {
			this.swapPlayerId = player.id;
			return;
		}

		const selectedTeam = this.teams[selectedTeamIndex];
		const selectedPlayerIndex = selectedTeam.players.findIndex(
			(candidate) => candidate.id === this.swapPlayerId,
		);
		const targetPlayerIndex = team.players.findIndex(
			(candidate) => candidate.id === player.id,
		);
		if (selectedPlayerIndex === -1 || targetPlayerIndex === -1) {
			this.swapPlayerId = null;
			return;
		}

		const updatedTeams = this.teams.map((candidate) => ({
			...candidate,
			players: [...candidate.players],
		}));
		updatedTeams[selectedTeamIndex].players[selectedPlayerIndex] = player;
		updatedTeams[targetTeamIndex].players[targetPlayerIndex] = selectedTeam.players[selectedPlayerIndex];
		updatedTeams.forEach((candidate) => {
			candidate.average = this.teamAverage(candidate.players);
		});
		this.teams = updatedTeams;
		this.balanceGap = Math.abs(updatedTeams[0].average - updatedTeams[1].average);
		this.swapPlayerId = null;
		this.teamsMessageCopied = false;
		this.teamsMessageError = '';
		this.changeDetector.detectChanges();
	}

	private teamAverage(players: Player[]): number {
		return SKILLS.reduce((teamTotal, skill) => {
			const ratings = players
				.map((player) => player.stats[skill])
				.filter((rating): rating is number => rating !== null);
			const skillAverage = ratings.length
				? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
				: 0;
			return teamTotal + skillAverage;
		}, 0) / SKILLS.length;
	}

	teamSkillAverage(team: Team, skill: Skill): number | null {
		const ratings = team.players
			.map((player) => player.stats[skill])
			.filter((rating): rating is number => rating !== null);
		return ratings.length
			? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
			: null;
	}

	teamsWhatsAppMessage(): string {
		const teamLines = this.teams.map((team) =>
			`*${team.name}*\n${team.players.map((player) => `• ${player.name}`).join('\n')}`,
		);
		return [
			'⚽ *Thursday Futsal — 21:00*',
			'',
			...teamLines.flatMap((line) => [line, '']),
			`⚖️ Team skill gap: ${this.balanceGap.toFixed(1)} points`,
			'See you there! 🙌',
		].join('\n').trim();
	}

	async copyTeamsMessage(): Promise<void> {
		if (!this.teams.length) return;
		this.teamsMessageCopied = false;
		this.teamsMessageError = '';
		try {
			await navigator.clipboard.writeText(this.teamsWhatsAppMessage());
			this.teamsMessageCopied = true;
		} catch {
			this.teamsMessageError = 'Clipboard access is unavailable. Select and copy the message above.';
		}
		this.changeDetector.detectChanges();
	}

	isOwnPlayer(player: Player): boolean {
		return this.sessionUser?.role === 'member' && this.sessionUser.playerId === player.id;
	}

	isPlayerSelected(player: Player): boolean {
		return this.selectedPlayerIds.includes(player.id);
	}

	togglePlayer(player: Player, event: Event): void {
		const checkbox = event.target;
		if (!(checkbox instanceof HTMLInputElement)) return;
		this.selectedPlayerIds = checkbox.checked
			? [...this.selectedPlayerIds, player.id]
			: this.selectedPlayerIds.filter((id) => id !== player.id);
	}

	skillLabel(skill: Skill): string {
		return skill === 'dribbling' ? 'Dribbling' : skill === 'defending' ? 'Defending' : skill[0].toUpperCase() + skill.slice(1);
	}

	leagueMedian(skill: Skill): number | null {
		const values = this.players.map((player) => player.stats[skill]).filter((value): value is number => value !== null).sort((a, b) => a - b);
		if (!values.length) return null;
		const middle = Math.floor(values.length / 2);
		return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
	}

	async login(): Promise<void> {
		if (this.loginBusy) return;
		this.loginBusy = true;
		this.loginError = '';
		try {
			const result = await firstValueFrom(this.http.post<{ user: SessionUser }>('/api/auth/login', {
				username: this.loginUsername.trim(),
				password: this.loginPassword,
			}));
			this.sessionUser = result.user;
			this.loginPassword = '';
			this.changeDetector.detectChanges();
			await this.loadDashboard();
		} catch (error) {
			this.loginError = error instanceof HttpErrorResponse && error.status === 401
				? 'Username or password is incorrect.'
				: 'Could not sign in. Check that the league server is available.';
		} finally {
			this.loginBusy = false;
			this.changeDetector.detectChanges();
		}
	}

	async logout(): Promise<void> {
		try {
			await firstValueFrom(this.http.post<void>('/api/auth/logout', {}));
			this.clearMatchRefresh();
			this.sessionUser = null;
			this.players = [];
			this.memberAccounts = [];
			this.teams = [];
			this.activeMatch = null;
			this.modal = null;
			this.changeDetector.detectChanges();
		} catch (error) {
			this.showApiError(error);
		}
	}

	private async loadDashboard(): Promise<void> {
		try {
			this.players = await firstValueFrom(this.http.get<Player[]>('/api/players'));
			this.selectedPlayerIds = this.players.slice(0, 10).map((player) => player.id);
			this.changeDetector.detectChanges();
			if (this.isAdmin) {
				this.memberAccounts = await firstValueFrom(this.http.get<MemberAccount[]>('/api/users'));
			} else {
				this.memberAccounts = [];
			}
			this.changeDetector.detectChanges();
		} catch (error) {
			this.showApiError(error);
			this.changeDetector.detectChanges();
		}
	}

	openAddPlayer(): void {
		if (!this.isAdmin) return;
		this.newPlayerName = '';
		this.modal = 'player';
	}

	async openRating(player: Player): Promise<void> {
		if (this.isOwnPlayer(player)) return;
		this.errorMessage = '';
		this.selectedPlayer = player;
		this.modal = 'rating';
		this.ratingDraft = { dribbling: 5, speed: 5, shooting: 5, stamina: 5, passing: 5, defending: 5 };
		this.ratingLoading = true;
		this.ratingLoadError = '';
		const requestId = ++this.ratingRequestId;
		try {
			const rating = await firstValueFrom(
				this.http.get<RatingStats | null>(`/api/players/${player.id}/my-rating`),
			);
			if (requestId !== this.ratingRequestId || this.selectedPlayer?.id !== player.id) return;
			if (rating) this.ratingDraft = { ...rating };
		} catch {
			if (requestId !== this.ratingRequestId || this.selectedPlayer?.id !== player.id) return;
			this.ratingLoadError = 'Could not load your previous rating. Try again before submitting.';
		} finally {
			if (requestId === this.ratingRequestId && this.selectedPlayer?.id === player.id) {
				this.ratingLoading = false;
				this.changeDetector.detectChanges();
			}
		}
	}

	openDelete(player: Player): void {
		if (!this.isAdmin) return;
		this.errorMessage = '';
		this.selectedPlayer = player;
		this.modal = 'delete';
	}

	closeModal(): void {
		if (this.deletingPlayer || this.creatingMember) return;
		this.ratingRequestId += 1;
		this.ratingLoading = false;
		this.ratingLoadError = '';
		this.generatedCredentials = null;
		this.userAdminError = '';
		this.modal = null;
		this.selectedPlayer = null;
		this.errorMessage = '';
	}

	async deletePlayer(): Promise<void> {
		const player = this.selectedPlayer;
		if (!player || !this.isAdmin || this.deletingPlayer) return;

		this.deletingPlayer = true;
		this.errorMessage = '';
		try {
			await firstValueFrom(this.http.delete<void>(`/api/players/${player.id}`));
			this.players = this.players.filter((candidate) => candidate.id !== player.id);
			this.selectedPlayerIds = this.selectedPlayerIds.filter((id) => id !== player.id);
			this.memberAccounts = this.memberAccounts.filter((member) => member.playerId !== player.id);
			this.teams = [];
			this.modal = null;
			this.selectedPlayer = null;
			this.changeDetector.detectChanges();
		} catch (error) {
			this.errorMessage = error instanceof HttpErrorResponse && error.status === 409
				? 'Remove this player’s member login before deleting their profile.'
				: 'Could not delete this player. Check your connection and try again.';
			this.changeDetector.detectChanges();
		} finally {
			this.deletingPlayer = false;
			this.changeDetector.detectChanges();
		}
	}

	async addPlayer(): Promise<void> {
		if (!this.isAdmin) return;
		const name = this.newPlayerName.trim();
		if (!name) return;
		try {
			const saved = await firstValueFrom(this.http.post<Player>('/api/players', { name }));
			this.players = [...this.players, saved];
			this.modal = null;
			this.newPlayerName = '';
			this.changeDetector.detectChanges();
		} catch (error) {
			this.showApiError(error);
			this.changeDetector.detectChanges();
		}
	}

	async saveRating(): Promise<void> {
		if (!this.selectedPlayer || this.ratingLoading || this.ratingLoadError) return;
		const player = this.selectedPlayer;
		if (this.isOwnPlayer(player)) return;
		try {
			const updated = await firstValueFrom(this.http.post<Player>(`/api/players/${player.id}/ratings`, {
				stats: this.ratingDraft,
			}));
			this.players = this.players.map((candidate) => candidate.id === updated.id ? updated : candidate);
			this.closeModal();
			this.changeDetector.detectChanges();
		} catch (error) {
			this.showApiError(error);
			this.changeDetector.detectChanges();
		}
	}

	async generateTeams(): Promise<void> {
		const selected = this.selectedPlayerIds
			.map((id) => this.players.find((player) => player.id === id))
			.filter((player): player is Player => player !== undefined);
		if (selected.length !== this.selectedCount) {
			this.errorMessage = `Select exactly ${this.selectedCount} players to build teams.`;
			this.teams = [];
			this.swapPlayerId = null;
			return;
		}
		if (selected.some((player) => player.ratingCount === 0)) {
			this.errorMessage = 'Every selected player needs at least one peer rating.';
			this.teams = [];
			this.swapPlayerId = null;
			return;
		}
		this.errorMessage = '';
		this.swapPlayerId = null;
		this.teamsMessageCopied = false;
		this.teamsMessageError = '';
		try {
			const result = await firstValueFrom(this.http.post<{ teams: Team[]; balanceGap: number }>('/api/teams/generate', {
				playerIds: selected.map((player) => player.id),
			}));
			this.teams = result.teams;
			this.balanceGap = result.balanceGap;
			this.changeDetector.detectChanges();
			document.getElementById('team-builder')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		} catch (error) {
			this.showApiError(error);
			this.changeDetector.detectChanges();
		}
	}

	scrollToPlayers(): void {
		document.getElementById('players')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	scrollToTeamBuilder(): void {
		document.getElementById('team-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	openUserManagement(): void {
		if (!this.isAdmin) return;
		this.userAdminError = '';
		this.generatedCredentials = null;
		this.newUsername = '';
		this.newMemberPlayerId = '';
		this.modal = 'users';
		void this.refreshMembers();
	}

	private async refreshMembers(): Promise<void> {
		try {
			this.memberAccounts = await firstValueFrom(this.http.get<MemberAccount[]>('/api/users'));
			this.changeDetector.detectChanges();
		} catch (error) {
			this.userAdminError = 'Could not load member accounts.';
			this.showApiError(error);
			this.changeDetector.detectChanges();
		}
	}

	async createMember(): Promise<void> {
		if (!this.isAdmin || this.creatingMember) return;
		this.creatingMember = true;
		this.userAdminError = '';
		this.generatedCredentials = null;
		try {
			const result = await firstValueFrom(this.http.post<{
				user: MemberAccount;
				temporaryPassword: string;
			}>('/api/users', {
				username: this.newUsername.trim(),
				playerId: this.newMemberPlayerId,
			}));
			this.memberAccounts = [...this.memberAccounts, result.user].sort((a, b) => a.username.localeCompare(b.username));
			this.generatedCredentials = { username: result.user.username, password: result.temporaryPassword };
			this.newUsername = '';
			this.newMemberPlayerId = '';
			this.changeDetector.detectChanges();
		} catch (error) {
			this.userAdminError = error instanceof HttpErrorResponse && error.status === 409
				? 'That username or player already has an account.'
				: 'Could not create the member account.';
			this.showApiError(error);
			this.changeDetector.detectChanges();
		} finally {
			this.creatingMember = false;
			this.changeDetector.detectChanges();
		}
	}

	async copyPassword(): Promise<void> {
		if (!this.generatedCredentials) return;
		try {
			await navigator.clipboard.writeText(this.generatedCredentials.password);
		} catch {
			this.userAdminError = 'Clipboard access is unavailable. Select and copy the password manually.';
		}
	}

	async removeMember(member: MemberAccount): Promise<void> {
		if (!this.isAdmin || !confirm(`Remove the login for ${member.username}?`)) return;
		try {
			await firstValueFrom(this.http.delete<void>(`/api/users/${member.id}`));
			this.memberAccounts = this.memberAccounts.filter((account) => account.id !== member.id);
			this.changeDetector.detectChanges();
		} catch (error) {
			this.userAdminError = 'Could not remove this member account.';
			this.showApiError(error);
			this.changeDetector.detectChanges();
		}
	}

	playerName(playerId?: string): string {
		return this.players.find((player) => player.id === playerId)?.name ?? 'Player profile unavailable';
	}

	private showApiError(error: unknown): void {
		if (error instanceof HttpErrorResponse && error.status === 401) {
			this.clearMatchRefresh();
			this.sessionUser = null;
			this.players = [];
			this.memberAccounts = [];
			this.teams = [];
			this.activeMatch = null;
			this.modal = null;
			this.loginError = 'Your session expired. Please sign in again.';
			return;
		}
		this.errorMessage = 'The league server could not save your change. Check your connection and try again.';
	}
}
