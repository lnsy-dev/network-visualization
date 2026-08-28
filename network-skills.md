```network-visualization
JavaScript:
  # EcmaScript (JavaScript)
  The most widely used programming language on the web, with a mature ecosystem and modern standards that continue to expand what is possible in the browser.
CSS:
  # Cascading Style Sheets (CSS)
  CSS shapes the feel and behavior of a site more than any other technology. I am often brought in specifically to solve complex interface and layout challenges.
HTML:
  # HTML
  Modern HTML is extensible through Custom Elements and styleable with XSL. Using it fully enables faster, more resilient, longer-lived websites.
The Web:
  # The Web
  From DNS to ES6, I advise on how to use the world's most powerful mass-communication platform effectively.
Node.js:
  # Node.js
  A proven JavaScript runtime for servers, scripts, and tools — from production services to internal automation.
Bun.sh:
  # Bun.sh
  A modern JavaScript runtime with built-in PostgreSQL support and a well-designed file API, well-suited for internal and local-first applications.
QuickJS:
  # QuickJS
  A compact runtime designed to run across chip architectures, compile JS for speed, and interoperate with C libraries.
SQL:
  # SQL
  The foundation of most structured data systems. I help design, visualize, and optimize databases across SQL, NoSQL, and graph technologies.
Databases:
  # Databases
  Decades of experience with database design and operation, from relational systems to vector and graph stores.
PostGres:
  # PostgreSQL
  A capable, extensible, and high-performance relational database.
N8N:
  # N8N
  A visual programming environment for orchestrating AI workflows, document indexing, and custom chatbots.
Node-Red:
  # Node-RED
  A mature open-source alternative for AI and IoT workflow orchestration.
Linux:
  # Linux
  Decades of experience deploying and maintaining Linux servers and desktops.
Framework Du Jour:
  # Framework Du Jour
  React, Vue, HTMX, Next.js, and others. I select the right-sized technology for each organization — no upsells, no resume-driven development, just honest assessments.
Mapping:
  # Mapping
  Deep experience across the geospatial stack, from ArcGIS and Mapbox to OpenStreetMap, Leaflet, and Google Earth Engine.
ArcGIS:
  # ArcGIS
  Enterprise GIS platform with extensive production experience.
ESRI:
  # ESRI
  Enterprise mapping and spatial analytics.
MapBox:
  # MapBox
  Built custom mapping frameworks on this platform.
OpenStreetMap:
  # OpenStreetMap
  Collaborative, open geographic data.
Leaflet:
  # Leaflet
  Lightweight, open-source mapping library.
Google Earth Engine:
  # Google Earth Engine
  Planetary-scale geospatial analysis for science and policy applications.
Visual Programming Languages:
  # Visual Programming Languages
  Graphical environments that clarify queue-based, event-driven, and AI workflows.
Software:
  # Software
  The craft of applying logic and language to build systems that shape culture and commerce.
Obsidian.md:
  # Obsidian.md
  A powerful, extensible note-taking and knowledge-management platform. I customize Obsidian setups for individuals and teams.

---
(JavaScript|wireframe:true;shape:torus) --> (HTML|wireframe:true;shape:cube)
(CSS|wireframe:true) --> (HTML|wireframe:true)
(JavaScript) --> (The Web|shape:sphere;wireframe:true)
(CSS) --> (The Web)
(HTML) --> (The Web)
(Node.js|wireframe:true;shape:cube) --> (JavaScript)
(Node.js) --> (Bun.sh|wireframe:true;shape:cube)
(Bun.sh) --> (JavaScript)
(QuickJS|wireframe:true;shape:cube) --> (JavaScript)
(Databases|wireframe:true;shape:cube) --> (SQL|wireframe:true;shape:cube)
(Bun.sh|wireframe:true;shape:cube) --> (PostGres|wireframe:true;shape:cube)
(PostGres|wireframe:true;shape:cube) --> (SQL|wireframe:true;shape:cube)
(PostGres) --> (Databases)
(ESRI|wireframe:true;shape:cube) --> (Mapping|wireframe:true;shape:cube)
(MapBox|wireframe:true;shape:cube) --> (Mapping)
(ArcGIS|wireframe:true;shape:cube) --> (Mapping)
(OpenStreetMap|wireframe:true;shape:cube) --> (Mapping)
(Leaflet|wireframe:true;shape:cube) --> (Mapping)
(Google Earth Engine|wireframe:true;shape:cube) --> (Mapping)
(MapBox) --> (JavaScript)
(Framework Du Jour|wireframe:true;shape:sphere) --> (JavaScript)
(Visual Programming Languages|wireframe:true;shape:sphere) --> (Node-Red|wireframe:true;shape:sphere)
(Visual Programming Languages) --> (N8N|wireframe:true;shape:sphere)
(Software|wireframe:true,shape:torus) -> (JavaScript)
(Software) --> (Visual Programming Languages)
(Software) --> (The Web)
(Linux|wireframe:true) --> (Software)
(Linux) --> (The Web)
```
