# 25. Local Cognitive Second Brain Mode

## 25.1 Purpose

Local Cognitive Second Brain Mode defines how Genius Cognitive System (GCS) operates as a private, user-owned memory and reasoning system on a local device, workstation, SMB appliance, enterprise node, or private GNUS subnet.

This mode is intended for personal, SMB, and enterprise use cases where the system must remember evolving work context, prepare the user for meetings, track commitments, maintain project state, detect contradictions, and adapt over time without exposing private memory to the public GNUS swarm.

The core architectural claim is:

> The local second brain is a GCS agent mode backed by GAML, executed by local or private ELMs, coordinated by the orchestration layer, and improved over time through EGGROLL adaptation signals.

This is not merely an orchestration layer and not merely a note-taking application. It is a local cognitive operating mode inside the broader GCS architecture.

## 25.2 Architectural Position

Local Cognitive Second Brain Mode sits across five GCS components.

### 25.2.1 Orchestration Layer

The orchestration layer is the control plane. It decides:

- Whether a request should stay local, use private enterprise resources, or escalate to the public swarm.
- Which memory scope is allowed.
- Which ELM, agent chain, tool, grounding source, and validation path should be used.
- Whether the task requires arbitration, consensus, secure execution, or writeback.
- Whether EGGROLL adaptation signals may be emitted.

The orchestration layer does not replace the second brain. It supervises it.

### 25.2.2 GAML: GNUS Agentic Memory Layer

GAML is the memory substrate for the local second brain.

It stores structured long-term memory, including facts, claims, commitments, decisions, deadlines, preferences, user profile signals, project state, source references, contradictions, and reasoning traces.

GAML should support:

- Structured memory rather than loose summaries.
- Multi-hop reasoning over memory objects.
- Temporal coherence.
- Confidence scoring.
- Source grounding.
- Version-aware writeback.
- Contradiction tracking.
- Private/local memory scopes.

### 25.2.3 Local or Private ELMs

Local or private Expert Language Models perform reasoning over private memory.

They may run on:

- A Mac or PC.
- A Jetson or edge device.
- A local GNUS node.
- A workstation.
- An SMB AI appliance.
- An enterprise private subnet.

These ELMs handle tasks such as meeting prep, daily briefs, project recall, document drafting, task planning, personal search, workflow assistance, and private decision support.

### 25.2.4 Second Brain Agent

The Second Brain Agent is the behavioral wrapper around the local memory experience.

It handles user-facing workflows such as:

- “Prep me for my next meeting.”
- “What changed on this project?”
- “Who owes me what?”
- “What did we decide last week?”
- “What deadlines moved?”
- “Summarize my day.”
- “Draft the follow-up using what we already know.”

The agent retrieves memory, builds compact context packets, invokes the local/private ELM, calls permitted tools, returns the result, and writes confirmed updates back into GAML.

### 25.2.5 EGGROLL Adaptation Layer

EGGROLL is the learning loop.

In this mode, EGGROLL should not be limited to broad swarm retraining. It also supports private/local adaptation by converting repeated corrections, workflow outcomes, user preferences, failed retrievals, accepted drafts, rejected drafts, and verified task completions into adaptation signals.

These signals can improve:

- Private adapters.
- Local ELM behavior.
- Routing policies.
- Retrieval policies.
- Memory scoring policies.
- Prompt policies.
- Private fine-tuning jobs.
- Enterprise-specific model adaptation.

Private EGGROLL signals must remain scoped to the user or enterprise unless broader sharing is explicitly enabled.

## 25.3 High-Level Flow

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

## 25.4 Local Data Sources

The local second brain may ingest private or local context from:

- Email.
- Calendar.
- Meeting transcripts.
- Voice notes.
- Local notes.
- Markdown vaults.
- Documents and PDFs.
- Browser research captures.
- Project management systems.
- Source code repositories.
- CRM exports.
- Support tickets.
- Internal wikis.
- Filesystem folders.
- User corrections and feedback.

These sources are not automatically public. By default, second-brain memory belongs to the user, local device, enterprise account, or private subnet that generated it.

## 25.5 Structured Memory Objects

Local Cognitive Second Brain Mode should avoid treating memory as a loose pile of summaries. GAML should represent memory as typed objects.

Core memory object classes include:

- **Person**: name, role, organization, contact handles, relationship to user, interaction history, preferences, commitments, and trust signals.
- **Organization**: company, customer, partner, school, hospital, government agency, vendor, or internal group.
- **Project**: objective, stakeholders, status, open questions, milestones, blockers, risks, and related artifacts.
- **Decision**: what was decided, by whom, when, why, source references, and whether it has been superseded.
- **Commitment**: who promised what, to whom, by when, current status, source evidence, and follow-up history.
- **Deadline**: due date, owner, linked project, source event, confidence, and change history.
- **Task**: action item, owner, priority, dependency, due date, and completion state.
- **Fact**: stable claim with source, timestamp, confidence, and validation status.
- **Claim**: unverified or contested assertion awaiting confirmation.
- **Contradiction**: conflict between facts, claims, dates, owners, assumptions, or sources.
- **Preference**: user, team, or organization preference learned from behavior or explicit instruction.
- **Style Signal**: writing style, communication tone, formatting preference, or decision style.
- **Memory Trace**: retrieval path, reasoning dependency, arbitration decision, correction, or writeback event.

## 25.6 Memory Lifecycle

Each memory item should move through a lifecycle rather than being permanently accepted as truth immediately.

```text
Observe -> Extract -> Normalize -> Link -> Score -> Store -> Retrieve -> Reason -> Verify -> Write Back -> Adapt
```

### 25.6.1 Observe

Observer agents monitor permitted local sources and identify new or changed information.

### 25.6.2 Extract

Ingestion agents extract typed entities, facts, claims, commitments, decisions, deadlines, tasks, and preferences.

### 25.6.3 Normalize

The system resolves names, aliases, duplicate entities, date formats, references, and source metadata.

### 25.6.4 Link

New memory objects are linked to existing people, projects, organizations, topics, prior decisions, and related tasks.

### 25.6.5 Score

GAML assigns or updates confidence using source reliability, recency, repetition, user confirmation, contradiction status, and trust weight.

### 25.6.6 Store

Memory is stored in the local or private GAML store using version-aware records and immutable source references where possible.

### 25.6.7 Retrieve

The Second Brain Agent retrieves only the memory needed for the current task. Retrieval should be structured and reasoning-driven, not a raw vector similarity dump.

### 25.6.8 Reason

The selected local or private ELM reasons over the assembled memory packet, current user request, available tools, and relevant constraints.

### 25.6.9 Verify

For higher-risk outputs, the system checks source grounding, contradictions, stale assumptions, and possible missing context before responding.

### 25.6.10 Write Back

The result may update GAML with new tasks, decisions, confirmations, corrections, changed deadlines, user preferences, or reasoning traces.

### 25.6.11 Adapt

EGGROLL converts repeated corrections, successful outcomes, failed retrievals, preferred phrasing, and workflow patterns into adaptation signals.

## 25.7 Context Packet Assembly

A local second brain should not load the full memory vault into every prompt. Instead, the Second Brain Agent should assemble compact context packets.

A context packet may include:

- Current user request.
- Relevant active project state.
- Recent timeline.
- Key people and organizations.
- Open decisions.
- Open commitments.
- Deadlines.
- Contradictions or uncertainty.
- User preferences.
- Source references.
- Permitted tools.
- Privacy and execution constraints.

The goal is to give small local ELMs enough structured context to act intelligently without dragging the whole memory graph into context.

## 25.8 Human-Readable Memory Mirror

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

The mirror is not necessarily the source of truth. It is an inspectable view over GAML so users can see what the system believes, where it came from, and what changed.

## 25.9 Privacy Modes

Local Cognitive Second Brain Mode must support explicit privacy boundaries.

### 25.9.1 Local-Only Mode

All memory, inference, retrieval, writeback, and adaptation remain on the device.

### 25.9.2 Private Enterprise Mode

Memory may be shared inside a controlled enterprise subnet according to permissions, roles, and organizational policy.

### 25.9.3 Hybrid Mode

Private memory stays local or enterprise-contained, but non-private tasks may use public GNUS compute or public knowledge grounding.

### 25.9.4 Explicit Swarm Contribution Mode

Only approved, filtered, anonymized, or deliberately shared adaptation signals may contribute to broader swarm learning.

## 25.10 Example Workflows

### 25.10.1 Meeting Prep

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

### 25.10.2 Project Drift Detection

```text
User: What changed on the Nexlogic rollout this week?

Second Brain Agent:
  -> Retrieves project timeline
  -> Compares new emails, notes, deadlines, and decisions
  -> Detects changed assumptions or contradictions
  -> Summarizes material changes
  -> Flags stale commitments
```

### 25.10.3 Personal Daily Brief

```text
Scheduled agent:
  -> Reads Today context, calendar, inbox, tasks, and active projects
  -> Retrieves relevant people and commitments
  -> Produces daily brief
  -> Optionally generates voice summary locally
```

### 25.10.4 Private ELM Adaptation

```text
Repeated user corrections:
  -> Captured as preference and correction memory
  -> Converted into EGGROLL adaptation signals
  -> Used to tune local adapter, routing, or memory retrieval policy
  -> Improves future briefs and drafts
```

## 25.11 Implementation Requirements

A first implementation should include:

1. Local source connectors for files, notes, email, calendar, and meeting transcripts.
2. GAML object schemas for people, organizations, projects, decisions, commitments, deadlines, tasks, facts, claims, preferences, style signals, contradictions, and memory traces.
3. A Second Brain Agent with retrieval, context-packet assembly, local ELM invocation, permitted tool use, and writeback.
4. A human-readable memory mirror.
5. Privacy modes for local-only, private enterprise, hybrid, and explicit swarm contribution.
6. EGGROLL signal emission for corrections, retrieval failures, accepted outputs, rejected outputs, and repeated preferences.
7. Validation logic for stale memory, conflicting commitments, source-grounding checks, and permission boundaries.

## 25.12 Design Principle

The local second brain should behave like a private cognitive companion, not a cloud chatbot with a bigger context window.

It should remember because GAML stores structured state.
It should reason because local/private ELMs operate over compact context packets.
It should act because agents can use permitted tools.
It should improve because EGGROLL converts experience into adaptation.
It should remain trustworthy because the user can inspect the memory mirror and control privacy boundaries.

## 25.13 Summary

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
