# Cuadre Project

Cuadre is the generic commercial base that evolved from IsaCream. The goal is to turn
the original inventory and sales experience into a reusable product that can be sold
and adapted to new clients.

## Product Direction

- Cuadre should feel like a flexible business operations tool, not a project tied to a
  single brand or vertical.
- Prioritize inventory, sales, reports, mobile workflows, plans, client configuration,
  and future integrations.
- Keep the product simple enough for small businesses, but structured enough to scale
  into paid plans and custom implementations.
- Avoid hardcoding business-specific naming, copy, product categories, colors, or
  workflows unless the task explicitly asks for a client-specific variant.

## Current Stack

- Framework: Next.js 15 with React 19.
- Language: TypeScript.
- Package manager: pnpm 10.
- Backend/data: Supabase.
- Styling: global CSS and component-level styles currently in the app.
- Icons: lucide-react.
- Main app code: `src/app`, `src/components`, `src/lib`, `src/types`.
- Database schema: `supabase/schema.sql`.

## Commands

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run type-check
pnpm run lint
```

Use `pnpm run type-check` and `pnpm run lint` before considering a code change complete
when the change touches TypeScript, React components, data contracts, or shared logic.

## Environment

Copy `.env.example` to `.env.local` and configure:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Supabase changes should be reflected in `supabase/schema.sql`. Do not assume database
objects exist unless they are represented there or clearly documented in the task.

## Development Rules

- Prefer reusable Cuadre language over IsaCream-specific language.
- Keep changes small and focused on the requested feature.
- Follow existing folder patterns before introducing new abstractions.
- Use TypeScript types for business entities, plan limits, configuration, and report
  data instead of loose objects.
- Keep UI states complete: loading, empty, error, success, disabled, and mobile states
  where relevant.
- Avoid adding dependencies unless they clearly reduce implementation risk or match an
  established need.
- Do not remove existing user changes unless explicitly asked.

## Frontend Guidelines

- Design for frequent operational use: fast scanning, clear actions, compact layouts,
  and predictable navigation.
- Mobile matters. Any new screen or major component should be checked at mobile and
  desktop sizes.
- Prefer real controls over explanatory text: buttons, tabs, filters, selects, toggles,
  and forms should make the workflow obvious.
- Use `lucide-react` icons when an icon is needed.
- Avoid brand-specific visuals until Cuadre has a deliberate brand system.
- Keep text concise and business-focused.

## Data And Business Logic

- Separate UI formatting from business calculations.
- Centralize currency, date, quantity, stock, and report helpers in `src/lib` when they
  are reused.
- Plan and subscription logic should be explicit and testable. Do not scatter plan
  limits across unrelated components.
- Integrations should be isolated behind small modules so client-specific providers can
  be swapped later.

## Git And Releases

- `origin` points to `AndreyK-2305/Cuadre.git`.
- The original IsaCream repository may exist as a reference remote named `isacream`.
- Do not push to the IsaCream repository.
- Use clear commit messages that describe the product change, not just the file edited.
- Before pushing, confirm the branch and remote.

## Definition Of Done

A change is ready when:

- The requested behavior is implemented.
- TypeScript and lint checks pass, or any skipped check is explained.
- The UI has been checked for obvious desktop and mobile issues when relevant.
- Supabase/schema changes are documented or included.
- No unrelated user changes were overwritten.

## Initial Roadmap Notes

- Rename remaining IsaCream references to Cuadre or generic product language.
- Prepare plan structure and feature limits.
- Improve mobile sales and inventory workflows.
- Add configuration points for different client types.
- Prepare integration boundaries for future services.
- Strengthen README and onboarding docs as the project stabilizes.
