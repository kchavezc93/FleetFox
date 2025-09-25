# **App Name**: FleetFox

## Core Features:

- Vehicle List View: Display vehicle list with filtering options.
- Fueling Log Input: Input form for fueling log data with date, mileage, and cost calculation
- Preventive Maintenance Scheduler: Schedule maintenance reminders to prevent vehicle downtime
- Maintenance Record Submission: Form for submitting information about vehicle maintenance records.
- Fuel Consumption Report: Show total gallons and cost by vehicle in a date range.
- Report Export: Allow CSV and Excel data export.
 

## Database schema (source of truth)

- Single, idempotent script: `docs/db/fleetfox_schema.sql`
- Run it to create/update all required objects (users, sessions, vehicles, fueling_logs, fueling_vouchers, maintenance_logs, attached_documents, settings, audit_events).
- Any future DB change must be applied in that unified SQL file. The older fragmented scripts under `docs/sql/` are deprecated and will be removed.

## Style Guidelines:

- Primary color: Forest green (#386641) to evoke reliability and nature. 
- Background color: Light beige (#F5F3E4). This provides a gentle contrast, setting a clean, neutral stage that supports legibility and reduces visual fatigue.
- Accent color: Mustard yellow (#D6AD60) to highlight actionable items.
- Use clear and professional fonts for forms and tables.
- Simple, easily recognizable icons to represent vehicles, maintenance, and reports.
- Dashboard layout should be clean with key metrics prominently displayed.