import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, of } from 'rxjs';

const SKILLS = ['dribbling', 'speed', 'shooting', 'stamina', 'passing', 'defending'] as const;
type Skill = (typeof SKILLS)[number];
type PlayerStats = Record<Skill, number | null>;

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
          <button class="nav-item active"><span class="nav-icon">◫</span> Dashboard</button>
          <button class="nav-item" (click)="scrollToPlayers()"><span class="nav-icon">◎</span> Players <span class="nav-count">{{ players.length }}</span></button>
          @if (isAdmin) {
            <button class="nav-item" (click)="openUserManagement()"><span class="nav-icon">♙</span> Members <span class="nav-count">{{ memberAccounts.length }}</span></button>
            <button class="nav-item" (click)="scrollToTeamBuilder()"><span class="nav-icon">⌘</span> Team builder</button>
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
          <div class="breadcrumb">Thursday league <span>/</span> <strong>Overview</strong></div>
          <div class="top-actions">
            <div class="week-chip"><span class="live-dot"></span> Week 24 <span class="chip-divider"></span> Nov 12</div>
            <button class="icon-button" aria-label="Notifications">♧<span class="notification-dot"></span></button>
            <span class="top-avatar">{{ initials(sessionUser.username) }}</span>
          </div>
        </header>

        <div class="content">
          @if (errorMessage) {
            <div class="error-banner" role="alert">{{ errorMessage }}</div>
          }

          <section class="welcome-row">
            <div>
              <div class="eyebrow"><span class="eyebrow-line"></span> YOUR LEAGUE AT A GLANCE</div>
              <h1>Good game starts<br />with a <span>fair one.</span></h1>
              <p class="welcome-copy">Know your players. Build balanced teams. Make every match count.</p>
            </div>
            <div class="match-card">
              <div class="match-card-top"><span class="upcoming-label"><span class="live-dot"></span> NEXT MATCH</span><span class="match-menu">···</span></div>
              <div class="match-date">THU <strong>12</strong> NOV</div>
              <div class="match-opponents"><span class="team-badge badge-lime">A</span><span class="versus">VS</span><span class="team-badge badge-purple">B</span><span class="match-names">Team A <span>vs</span> Team B</span></div>
              <div class="match-location"><span>⌖</span> Riverside Sports Hall <span class="location-dot">·</span> 7:30 PM</div>
            </div>
          </section>

          <section class="stats-row" aria-label="League overview">
            <article class="stat-card">
              <div class="stat-top"><span class="stat-label">PLAYERS</span><span class="stat-icon green-icon">♙</span></div>
              <div class="stat-value">{{ players.length }}<span class="stat-total"> / 16</span></div>
              <div class="stat-foot"><span class="tiny-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Roster spots filled</span></div>
            </article>
            <article class="stat-card">
              <div class="stat-top"><span class="stat-label">RATINGS COLLECTED</span><span class="stat-icon blue-icon">◈</span></div>
              <div class="stat-value">{{ totalRatings }}<span class="stat-change">+12%</span></div>
              <div class="stat-foot"><span class="stat-foot-dot blue-dot"></span><span>Peer reviews this season</span></div>
            </article>
            <article class="stat-card">
              <div class="stat-top"><span class="stat-label">MATCHES PLAYED</span><span class="stat-icon orange-icon">◷</span></div>
              <div class="stat-value">08<span class="stat-total"> / 12</span></div>
              <div class="stat-foot"><span class="progress-track"><span class="progress-value"></span></span><span>Season in progress</span></div>
            </article>
            <article class="stat-card highlight-stat">
              <div class="stat-top"><span class="stat-label">TEAM BALANCE</span><span class="stat-icon lime-icon">✳</span></div>
              <div class="stat-value">94<span class="stat-unit">%</span><span class="balance-tag">GREAT</span></div>
              <div class="stat-foot"><span class="stat-foot-dot lime-dot"></span><span>Last matchup fairness score</span></div>
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
                  <thead><tr>@if (isAdmin) { <th>TEAM</th> }<th>PLAYER</th><th>DRIBBLE</th><th>SPEED</th><th>SHOOTING</th><th>STAMINA</th><th>PASSING</th><th>DEFENCE</th><th>REVIEWS</th><th></th></tr></thead>
                  <tbody>
                    @for (player of filteredPlayers; track player.id; let i = $index) {
                      <tr>
                        @if (isAdmin) { <td><input class="team-select-checkbox" type="checkbox" [checked]="isPlayerSelected(player)" [disabled]="!player.ratingCount" [attr.aria-label]="'Select ' + player.name + ' for teams'" (change)="togglePlayer(player, $event)" /></td> }
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
                      <tr><td class="empty-row" [attr.colspan]="isAdmin ? 10 : 9">No players match your search.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="table-footer"><span>Showing <strong>{{ filteredPlayers.length }}</strong> of <strong>{{ players.length }}</strong> players @if (isAdmin) { <i>·</i> <strong>{{ selectedPlayerIds.length }}</strong> selected }</span><button (click)="scrollToPlayers()">View all players <span>→</span></button></div>
            </article>

            <aside class="panel skills-panel">
              <div class="skills-heading"><div><div class="section-kicker">LEAGUE SNAPSHOT</div><h2>Skill averages</h2></div><button class="more-button" aria-label="More options">···</button></div>
              <p class="panel-subtitle">Median ratings across all players</p>
              <div class="skill-list">
                @for (skill of skills; track skill) {
                  <div class="skill-row">
                    <div class="skill-label"><span>{{ skillLabel(skill) }}</span><strong>{{ formatScore(leagueMedian(skill)) }}<small>/10</small></strong></div>
                    <div class="skill-track"><span class="skill-fill fill-{{ $index }}" [style.width.%]="(leagueMedian(skill) ?? 0) * 10"></span></div>
                  </div>
                }
              </div>
              <div class="insight-card"><span class="insight-spark">✳</span><div><strong>Defence is your edge</strong><p>Your league's strongest skill. Keep it up on match day.</p></div></div>
            </aside>
          </section>

          @if (isAdmin) {
          <section class="panel builder-panel" id="team-builder">
            <div class="builder-copy">
              <div class="builder-icon">✳</div>
              <div><div class="section-kicker">MATCH DAY, MADE FAIR</div><h2>Build your balanced teams</h2><p>Pick 10 players and let player ratings do the heavy lifting.</p></div>
            </div>
            <div class="builder-controls">
              <label class="select-wrap"><span>PLAYERS</span><select [(ngModel)]="selectedCount"><option [ngValue]="10">10 players · 5v5</option><option [ngValue]="8">8 players · 4v4</option></select></label>
              <button class="build-button" (click)="generateTeams()">✨ <span>Build teams</span></button>
            </div>
            @if (teams.length) {
              <div class="teams-result">
                @for (team of teams; track team.name; let i = $index) {
                  <div class="team-result-card">
                    <div class="result-team-heading"><span class="team-badge" [class.badge-lime]="i === 0" [class.badge-purple]="i === 1">{{ i === 0 ? 'A' : 'B' }}</span><strong>Team {{ i === 0 ? 'A' : 'B' }}</strong><span class="team-average">{{ team.average | number:'1.1-1' }} avg</span></div>
                    <div class="team-player-list">@for (player of team.players; track player.id) { <span>{{ player.name }}</span> }</div>
                  </div>
                }
                <div class="balance-result"><span class="balance-result-icon">✓</span><strong>Teams balanced</strong><span>{{ balanceGap | number:'1.1-1' }} point skill gap</span></div>
              </div>
            }
          </section>
          }

          <footer class="page-footer"><span>fiveaside<span class="brand-period">.</span> <span>Built for the love of the game.</span></span><span>Thursday league <i>·</i> Season 2026</span></footer>
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
          <div class="rating-fields">@for (skill of skills; track skill) { <label class="rating-field"><span>{{ skillLabel(skill) }}</span><input type="range" min="1" max="10" step="1" [(ngModel)]="ratingDraft[skill]" /><strong>{{ ratingDraft[skill] }}</strong></label> }</div>
          <button class="build-button modal-submit" (click)="saveRating()">Submit rating <span>→</span></button>
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
  ratingDraft: Record<Skill, number> = { dribbling: 7, speed: 7, shooting: 7, stamina: 7, passing: 7, defending: 7 };
  teams: Team[] = [];
  balanceGap = 0;

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
      this.sessionUser = null;
      this.players = [];
      this.memberAccounts = [];
      this.teams = [];
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

  openRating(player: Player): void {
    if (this.isOwnPlayer(player)) return;
    this.errorMessage = '';
    this.selectedPlayer = player;
    this.ratingDraft = { dribbling: 7, speed: 7, shooting: 7, stamina: 7, passing: 7, defending: 7 };
    this.modal = 'rating';
  }

  openDelete(player: Player): void {
    if (!this.isAdmin) return;
    this.errorMessage = '';
    this.selectedPlayer = player;
    this.modal = 'delete';
  }

  closeModal(): void {
    if (this.deletingPlayer || this.creatingMember) return;
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
      this.closeModal();
      this.changeDetector.detectChanges();
    } catch (error) {
      this.showApiError(error);
      this.changeDetector.detectChanges();
    }
  }

  async saveRating(): Promise<void> {
    if (!this.selectedPlayer) return;
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
    if (!this.isAdmin) return;
    const selected = this.selectedPlayerIds
      .map((id) => this.players.find((player) => player.id === id))
      .filter((player): player is Player => player !== undefined);
    if (selected.length !== this.selectedCount) {
      this.errorMessage = `Select exactly ${this.selectedCount} players to build teams.`;
      this.teams = [];
      return;
    }
    if (selected.some((player) => player.ratingCount === 0)) {
      this.errorMessage = 'Every selected player needs at least one peer rating.';
      this.teams = [];
      return;
    }
    this.errorMessage = '';
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
      this.sessionUser = null;
      this.players = [];
      this.memberAccounts = [];
      this.teams = [];
      this.modal = null;
      this.loginError = 'Your session expired. Please sign in again.';
      return;
    }
    this.errorMessage = 'The league server could not save your change. Check your connection and try again.';
  }
}
