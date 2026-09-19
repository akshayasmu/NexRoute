The Solution: NexRoute - By its people, For its people!
NexRoute is an accessibility-first public transport companion designed to help people with mobility challenges, elderly users, and commuters plan safer, more convenient journeys. Rather than simply defaulting to the fastest route, NexRoute asks, "What is the most suitable way for you to get there?"

It integrates real-time transport data, weather conditions, and facility status to recommend personalized journeys. Users can customize their profiles to prioritize step-free access, minimize walking distances, or maximize sheltered pathways, ensuring their commute is tailored to their exact physical needs.

The Uniqueness
While conventional navigation apps like Google Maps optimize strictly for travel time, NexRoute optimizes for accessibility, comfort, and safety. Its core differentiators include:

Real-Time Accessibility Rerouting: If a required lift breaks down, the app doesn't just notify the user—it proactively recalculates a step-free alternative.

Weather & Shelter-Aware Routing: It compares the amount of sheltered versus unsheltered walking, recommending drier or cooler routes during heavy rain or extreme heat.

Zero-Barrier User Experience: The app is designed for maximum usability right out of the gate, featuring a no-login profile system, text-to-speech narration, and high-legibility typography designed specifically for the visually impaired.

The Tech Stack
NexRoute is built using a lightweight, highly efficient stack focused on speed and accessibility without the overhead of heavy frameworks:

Frontend: Plain HTML, CSS, and Vanilla JavaScript for a fast, zero-build-step experience. It utilizes Leaflet.js for mapping and localStorage for saving user routines and profiles locally.

Accessibility Tooling: Atkinson Hyperlegible (Google Fonts) is used for maximum readability, alongside the browser's native Web Speech API for seamless read-aloud navigation.

Backend & Hosting: Deployed on Vercel utilizing Serverless Node.js Functions for lightweight, framework-free API route handling.

Database: Supabase (PostgreSQL) manages core user-generated data, including community barrier reports and family links.

Data Providers (External APIs):

LTA DataMall: Real-time train service alerts, lift/escalator maintenance, and bus arrivals.

OneMap: Accurate, localized walking route geometry.

Data.gov.sg: Live weather data for sheltered route calculations.