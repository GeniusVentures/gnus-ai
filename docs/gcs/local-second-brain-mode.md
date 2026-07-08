# Local Cognitive Second Brain Mode

## Purpose

Local Cognitive Second Brain Mode defines how Genius Cognitive System (GCS) operates as a private, user-owned memory and reasoning system on a local device or private node.

This mode is intended for personal, SMB, and enterprise use cases where the system must remember evolving work context, prepare the user for meetings, track commitments, maintain project state, and adapt over time without exposing private memory to the public GNUS swarm.

The key idea is simple:

> The local second brain is a GCS agent mode backed by GAML, executed by local or private ELMs, coordinated by the orchestration layer, and improved over time through EGGROLL adaptation signals.

This is not a standalone note-taking application. It is a local cognitive operating mode inside the broader GCS architecture.

## Architectural Position

Local Cognitive Second Brain Mode sits across five existing GCS concepts:

1. **Orchestration Layer**
   - Routes the request.
   - Determines whether the task should stay local, use private enterprise resources, or escalate to the public swarm.
   - Selects the proper ELMs, agents, tools, grounding sources, and memory scope.
   - Enforces privacy, latency, cost, and risk constraints.

2. **GAML: GNUS Agentic Memory Layer**
   - Stores structured long-term memory.
   - Maintains facts, claims, commitments, decisions, deadlines, preferences, user profile signals, project state, and contradiction history.
   - Supports temporal coherence, multi-hop reasoning, memory consensus, and writeback.

3. **Local or Private ELMs**
   - Perform local reasoning over private memory.
   - Handle meeting prep, daily briefs, project recall, document drafting, task planning, and personalized assistance.
   - May run on a Mac, PC, Jetson, workstation, SMB appliance, enterprise node, or private GNUS subnet.

4. **Second Brain Agent**
   - Provides the behavioral wrapper around the local memory experience.
   - Handles user-facing workflows such as “prep me for my next meeting,” “what changed on this project,” “who owes me what,” or “summarize my day.”
   - Performs tool calls, memory retrieval, brief generation, and structured writeback.

5. **EGGROLL Adaptation Layer**
   - Converts repeated use, verified corrections, user preferences, task outcomes, and memory updates into adaptation signals.
   - Improves private adapters, routing behavior, memory policies, and local ELM behavior over time.
   - Keeps private adaptation local or enterprise-contained unless the user or organization explicitly permits broader swarm learning.

## High-Level Flow

```text
Local Sources
  -> Observer and Ingestion Agents
  -> GAML Structured Memory
  -> Personal Memory / Second Brain Agent
  -> Local or Private ELM Reasoning
  -> User Answer, Action, Brief, or Draft
  -> GAML Writeback
  -> EGGROLL Adaptation Signals
  -> Improved Private ELMs, Adapters, Routing, and Memory Policies
```

## Local Data Sources

The second brain may ingest private or local context from:

- Email
- Calendar
- Meeting transcripts
- Local notes
- Markdown vaults
- Documents and PDFs
- Browser research captures
- Project management systems
- Source code repositories
- CRM exports
- Support tickets
- Internal wikis
- Filesystem folders
- Voice notes
- User corrections and feedback

These sources are not automatically public. By default, second-brain memory belongs to the user, local device, enterprise account, or private subnet that generated it.

## Structured Memory Objects

Local Cognitive Second Brain Mode should avoid treating memory as a loose pile of summaries. GAML should represent memory as typed objects.

Core memory object classes include:

- **Person**
  - Name, role, organization, contact handles, relationship to user, interaction history, preferences, commitments, and trust signals.

- **Organization**
  - Company, customer, partner, school, hospital, government agency, vendor, or internal group.

- **Project**
  - Active objective, stakeholders, status, open questions, milestones, blockers, risks, and related artifacts.

- **Decision**
  - What was decided, by whom, when, why, source references, and whether the decision has been superseded.

- **Commitment**
  - Who promised what, to whom, by when, current status, source evidence, and follow-up history.

- **Deadline**
  - Due date, owner, linked project, source event, confidence, and change history.

- **Task**
  - Action item, owner, priority, dependency, due date, and completion state.

- **Fact**
  - Stable claim with source, timestamp, confidence, and validation status.

- **Claim**
  - Unverified or contested assertion awaiting confirmation.

- **Contradiction**
  - Conflict between facts, claims, dates, owners, assumptions, or sources.

- **Preference**
  - User, team, or organization preference learned from behavior or explicit instruction.

- **Style Signal**
  - Writing style, communication tone, formatting preference, or decision style.

- **Memory Trace**
  - Retrieval path, reasoning dependency, arbitration decision, correction, or writeback event.

## Memory Lifecycle

Each memory item should move through a lifecycle rather than being permanently accepted as truth immediately.

```text
Observe -> Extract -> Normalize -> Link -> Score -> Store -> Retrieve -> Reason -> Verify -> Write Back -> Adapt
```

### Observe

Observer agents monitor permitted local sources and identify new or changed information.

### Extract

Ingestion agents extract typed entities, facts, claims, commitments, decisions, deadlines, tasks, and preferences.

### Normalize

The system resolves names, aliases, duplicate entities, date formats, references, and source metadata.

### Link

New memory objects are linked to existing people, projects, organizations, topics, prior decisions, and related tasks.

### Score

GAML assigns or updates confidence using source reliability, recency, repetition, user confirmation, contradiction status, and trust weight.

### Store

Memory is stored in the local or private GAML store using version-aware records and immutable source references where possible.

### Retrieve

The second brain agent retrieves only the memory needed for the current task. Retrieval should be structured and reasoning-driven, not a raw vector similarity dump.

### Reason

The selected local or private ELM reasons over the assembled memory packet, current user request, available tools, and relevant constraints.

### Verify

For higher-risk outputs, the system checks source grounding, contradictions, stale assumptions, and possible missing context before responding.

### Write Back

The result may update GAML with new tasks, decisions, confirmations, corrections, changed deadlines, user preferences, or reasoning traces.

### Adapt

EGGROLL converts repeated corrections, successful outcomes, failed retrievals, preferred phrasing, and workflow patterns into adaptation signals.

## Context Packet Assembly

A local second brain should not load the full memory vault into every prompt. Instead, the second brain agent should assemble compact context packets.

A context packet may include:

- Current user request
- Relevant active project state
- Recent timeline
- Key people and organizations
- Open decisions
- Open commitments
- Deadlines
- Contradictions or uncertainty
- User preferences
- Source references
- Permitted tools
- Privacy and execution constraints

The goal is to give small local ELMs enough structured context to act intelligently without dragging the whole memory graph into context.

## Human-Readable Memory Mirror

GAML is the structured memory substrate. However, users and enterprises need inspectability.

Local Cognitive Second Brain Mode should support a human-readable mirror such as:

```text
memory/
  Today.md
  People/
  Organizations/
  Projects/
  Decisions/
  Commitments/
  Deadlines/
  Tasks/
  Contradictions/
  Preferences/
  Sources/
```

This mirror may be Markdown, Obsidian-compatible files, HTML, or another portable representation.

The mirror is not the source of truth unless configured that way. It is an inspectable view over GAML so users can see what the system believes, where it came from, and what changed.

## Privacy Modes

Local Cognitive Second Brain Mode must support explicit privacy boundaries.

### Local-Only Mode

All memory, inference, retrieval, and adaptation remain on the device.

### Private Enterprise Mode

Memory may be shared inside a controlled enterprise subnet according to permissions, roles, and organizational policy.

### Hybrid Mode

Private memory stays local or enterprise-contained, but non-private tasks may use public GNUS compute or public knowledge grounding.

### Explicit Swarm Contribution Mode

Only approved, filtered, anonymized, or deliberately shared adaptation signals may contribute to broader swarm learning.

## Relationship to Orchestration

The orchestration layer does not replace the second brain. It supervises it.

The orchestration layer decides:

- Whether the request can be answered locally.
- Which memory scope is allowed.
- Which ELM or agent chain should run.
- Which tools may be invoked.
- Whether the task requires grounding, validation, arbitration, or consensus.
- Whether writeback is allowed.
- Whether adaptation signals should be emitted.

The second brain itself is the combination of local agent behavior, GAML memory, local/private ELM reasoning, source tools, writeback, and EGGROLL adaptation.

## Relationship to Agents

The second brain should be implemented as a GCS agent mode.

The **Second Brain Agent** is responsible for:

- Reading the user request.
- Asking the orchestration layer for allowed memory scope and execution mode.
- Requesting structured retrieval from GAML.
- Building a compact context packet.
- Selecting or invoking local/private ELM reasoning.
- Calling permitted tools.
- Returning a grounded answer, draft, action, or brief.
- Writing confirmed updates back into GAML.
- Emitting adaptation signals to EGGROLL when appropriate.

## Relationship to EGGROLL

EGGROLL should not be limited to large-scale swarm retraining. In Local Cognitive Second Brain Mode, EGGROLL also acts as the private learning loop.

EGGROLL can learn from:

- User corrections
- Repeated phrasing preferences
- Successful meeting prep patterns
- Failed retrievals
- Missed commitments
- Stale or wrong deadlines
- Tool-use outcomes
- Accepted drafts
- Rejected drafts
- Verified task completions
- Local evaluation results

EGGROLL outputs may include:

- Adapter updates
- Retrieval policy updates
- Router weight updates
- Prompt policy updates
- Memory scoring policy updates
- Local ELM fine-tuning jobs
- Private enterprise model adaptation jobs

Private EGGROLL signals must remain scoped to the user or enterprise unless sharing is explicitly enabled.

## Example Workflows

### Meeting Prep

```text
User: Prep me for my 2pm meeting with Sarah.

Second Brain Agent:
  -> Reads calendar event
  -> Resolves Sarah as a person entity
  -> Retrieves project links, recent emails, commitments, and open questions
  -> Builds context packet
  -> Invokes local ELM
  -> Produces meeting brief with sources and open action items
  -> Writes any user corrections back into GAML
```

### Project Drift Detection

```text
User: What changed on the Nexlogic rollout this week?

Second Brain Agent:
  -> Retrieves project timeline
  -> Compares new emails, notes, deadlines, and decisions
  -> Detects changed assumptions or contradictions
  -> Summarizes material changes
  -> Flags stale commitments
```

### Personal Daily Brief

```text
Scheduled agent:
  -> Reads Today context, calendar, inbox, tasks, and active projects
  -> Retrieves relevant people and commitments
  -> Produces daily brief
  -> Optionally generates voice summary locally
```

### Private ELM Adaptation

```text
Repeated user corrections:
  -> Captured as preference and correction memory
  -> Converted into EGGROLL adaptation signals
  -> Used to tune local adapter, routing, or memory retrieval policy
  -> Improves future briefs and drafts
```

## Implementation Requirements

A first implementation should include:

1. Local source connectors for files, notes, email, calendar, and meeting transcripts.
2. GAML object schemas for people, projects, decisions, commitments, deadlines, tasks, facts, claims, preferences, and contradictions.
3. A Second Brain Agent with retrieval, context-packet assembly, local ELM invocation, and writeback.
4. A human-readable memory mirror.
5. Privacy modes for local-only, private enterprise, hybrid, and explicit swarm contribution.
6. EGGROLL signal emission for corrections, retrieval failures, accepted outputs, and repeated preferences.
7. Validation logic for stale memory, conflicting commitments, and source-grounding checks.

## Design Principle

The local second brain should behave like a private cognitive companion, not a cloud chatbot with a bigger context window.

It should remember because GAML stores structured state.
It should reason because local/private ELMs operate over compact context packets.
It should act because agents can use permitted tools.
It should improve because EGGROLL converts experience into adaptation.
It should remain trustworthy because the user can inspect the memory mirror and control privacy boundaries.

## Summary

Local Cognitive Second Brain Mode turns GCS into a private memory and reasoning system for individuals, teams, SMBs, and enterprises.

The architecture can be summarized as:

```text
Orchestration = control plane
GAML = memory substrate
Local ELM = reasoning engine
Second Brain Agent = behavior layer
EGGROLL = adaptation loop
Human-readable mirror = inspectability layer
```

Together these form a local-first second brain that can scale upward into private enterprise cognition and, when permitted, outward into the distributed GNUS cognitive network.
