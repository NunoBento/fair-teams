# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Members of one weekly 5-a-side football group use the app to review the squad and prepare balanced teams. League admins manage player profiles and member accounts; members rate their peers.

## Product Purpose

Fiveaside helps a recurring 5-a-side group organize its player roster, gather peer ratings, build balanced teams, and record live match activity. Success means the group can prepare fair teams and keep match information together.

## Positioning

The app uses ratings from league members across six football skills—dribbling, speed, shooting, stamina, passing, and defending—to support team selection and balance. Peer ratings are its team-building mechanism.

## Operating Context

The app is for a weekly Thursday league match scheduled for 21:00. Members sign in to review players, rate other players, select a squad, generate teams, and follow live match activity. Admins can also manage player profiles and member accounts.

## Capabilities and Constraints

- The web app has admin and member roles.
- Members can rate other players across six skills; members cannot rate their own linked player profile.
- Team generation requires the selected players to have peer ratings.
- Live match workflows include recording goals and displaying match information.
- Do not assume or invent additional leagues, public signup, privacy policies, or supported scheduling beyond the current app.

## Brand Commitments

The existing product name is Fiveaside (shown as “fiveaside.” in the app). The app currently uses “Thursday league,” “5-a-side,” and football/futsal terminology; preserve these terms unless the product owner changes them.

## Evidence on Hand

The current app implementation in `src/app/app.ts` is the source for existing workflows and terminology. The repository contains no confirmed testimonials, customer claims, benchmarks, or case studies; do not fabricate them.

## Product Principles

- Help the group prepare fair teams from peer ratings.
- Keep roster, ratings, team building, and match activity in one league workspace.
- Respect the different responsibilities of admins and members.
- Preserve the weekly 5-a-side league context and its established terminology.
