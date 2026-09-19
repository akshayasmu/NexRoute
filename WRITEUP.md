NexRoute: By Its People, For Its People
The Solution
NexRoute is an accessibility-first public transport companion designed for commuters with mobility challenges, elderly individuals, and caregivers who require certainty over speed. Rather than defaulting to the quickest or shortest path, NexRoute asks: "What is the safest, most predictable way for you to reach your destination?"

It integrates real-time transit infrastructure status, weather tracking, and localized footpaths to generate personalized, guaranteed accessible journeys. Users can lock in requirements such as strictly step-free paths, zero-stair corridors, and maximum sheltered coverage, removing the anxiety of navigating the public transit network.

The Uniqueness
Conventional mapping applications optimize strictly for travel time and distance. NexRoute fundamentally shifts the focus to accessibility, comfort, and advance predictability:

Pre-Trip Facility Validation & Day-Before Alerts: Instead of reactive notifications when a user is already standing in front of an out-of-order lift, NexRoute runs an advance audit (including 24-hour proactive alerts) on station lifts, ramps, and clinic links.

Continuous Shelter-First Routing: Calculates localized walking geometry via covered HDB walkways, underpasses, and MRT linkways to minimize exposure to rain, wet slippery paths, and heat.

Predictable, "No-Improvisation" Assurance: Commuters who cannot make sudden detours or split-second platform decisions receive locked-in, verified door-to-door itineraries before stepping out the door.

Zero-Barrier, Senior-Friendly UX: Requires no login credentials or password management, features large high-contrast typography, and provides single-tap spoken audio guidance.

The Tech Stack
NexRoute is engineered with a lean, performant stack that prioritizes instant loading on low-power devices, zero setup overhead, and reliable data delivery:

Frontend: Plain HTML, CSS, and Vanilla JavaScript for ultra-fast, zero-build-step loading on any budget smartphone.

Mapping Engine: Leaflet.js for lightweight, responsive, and uncluttered map visualization.

Accessibility Tooling:

Atkinson Hyperlegible Font for clear character distinction and large, high-legibility interface copy.

Native Web Speech API for clear, built-in text-to-speech directions without external library weight.

Client Persistence: Native localStorage to retain accessibility profiles, routine destinations, and saved paths locally without requiring user accounts or logins.

Backend & Serverless API: Vercel Serverless Node.js Functions handling lightweight, performant API aggregation and routing logic.

Database: Supabase (PostgreSQL) for managing community-sourced accessibility alerts, persistent facility maintenance logs, and family link updates.

External Public Data Integrations:

LTA DataMall: Real-time train service alerts, bus arrival times, and live lift/escalator maintenance status across MRT stations.

OneMap API: Localized Singapore footpath routing and detailed sheltered linkway geometry.

Data.gov.sg: Live 2-hour weather forecasts and rainfall radar feeds to automate covered-path recommendations.

