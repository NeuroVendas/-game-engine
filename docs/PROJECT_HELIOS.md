# Project Helios

Project Helios is the first benchmark game for Forge =].

It is not a disposable demo. It is the primary real-world test for engine usability.

## Premise

The player enters what appears to be a normal energy generation facility.

The public facility contains an ordinary reactor and normal industrial operations.

Deep below the public complex is a classified antimatter reactor connected to secret research and operations.

The player can spend significant time in the public facility before discovering the classified program.

## Gameplay direction

Core loop:

OPERATE -> PROBLEM -> INVESTIGATE -> DECIDE -> CONSEQUENCE

The game should support more than catastrophic failures.

Events may include equipment faults, cooling problems, electrical faults, maintenance, alarms, access incidents, grid disturbances, containment issues, security events, and research events.

## Progression

Player progression may include separate concepts for player level, job rank, and security clearance.

Example progression:

- Trainee Technician
- Reactor Technician
- Senior Engineer
- Classified Operations
- Antimatter Specialist
- Reactor Control Director

Security clearance should gate classified areas independently from simple XP where useful.

## Reactor A — public

The public reactor should be a complete game loop by itself.

Systems may include startup/shutdown, power, cooling, pumps, electrical distribution, turbine/generator systems, alarms, emergency shutdown, and maintenance.

## AR-01 — classified

The secret reactor is an antimatter containment system.

Possible systems include containment field, magnetic arrays, injection, cooling, auxiliary power, chamber seal, emergency systems, and classified grid output.

## World structure

Surface Facility
- Administration
- Security
- Reactor A
  - Control Room
  - Turbine Hall
  - Pump Areas
  - Electrical
- Classified Access
  - Sublevel 7
    - Research
    - Security
    - Containment
    - AR-01

## Important reveal

The public reactor can support or mask systems used by the classified reactor.

Early players may see unexplained AUX GRID power draw.

Later players learn that the auxiliary load feeds classified containment systems.

## Why Helios matters to Forge

Project Helios should force Forge to prove modular level building, doors, clearance, scripting, interaction, UI, alarms, audio, components, power systems, multiplayer, roles, persistence, and publishing.

A Forge feature that only exists in theory is less valuable than one proven inside Helios.
