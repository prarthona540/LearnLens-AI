export const initialLearningDNA = {
  examReadinessScore: 78,
  strongTopics: [
    "Object-Oriented Programming & Polymorphism",
    "Database Normalization (1NF, 2NF, 3NF)",
    "HTTP Lifecycle & REST API Architecture",
    "Asynchronous Event Loop in Node.js",
  ],
  weakTopics: [
    "Dynamic Programming & Memoization",
    "B-Tree Indexing in Relational Databases",
    "JWT Refresh Token Rotation & Race Conditions",
  ],
  knowledgeGaps: [
    {
      topic: "Time Complexity of Graph Algorithms (Dijkstra vs Bellman-Ford)",
      severity: "high",
      detectedAt: "2026-11-06",
      recommendedAction: "Review notes on Shortest Path Algorithms and attempt a 5-question micro-quiz.",
    },
    {
      topic: "CAP Theorem Tradeoffs in Distributed Databases",
      severity: "medium",
      detectedAt: "2026-11-05",
      recommendedAction: "Complete the practice flashcards on Partition Tolerance vs Consistency.",
    },
    {
      topic: "CSS Subgrid & Anchor Positioning Fallbacks",
      severity: "low",
      detectedAt: "2026-11-04",
      recommendedAction: "Review Baseline CSS modern grid alignment specs.",
    },
  ],
  recommendedActions: [
    "Revise Dynamic Programming optimal substructure note before tomorrow's quiz",
    "Attempt 5-question micro-test on Graph Shortest Path algorithms",
    "Review JWT Token Rotation security architecture summary",
  ],
  lastUpdated: new Date().toISOString(),
};

export const initialNotes = [
  {
    _id: "note-1",
    title: "Operating Systems — CPU Scheduling & Deadlock Prevention",
    rawContent: `Deadlock happens when a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process.
Four Coffman conditions must hold simultaneously for a deadlock to occur:
1. Mutual Exclusion: At least one resource must be held in a non-shareable mode.
2. Hold and Wait: A process must be concurrently holding at least one resource and requesting additional resources.
3. No Preemption: Resources cannot be forcibly preempted from a process.
4. Circular Wait: A closed chain of processes exists, where each process holds resources needed by the next.

Deadlock Prevention involves invalidating at least one of these four conditions. For instance, imposing a total ordering on all resource acquisitions completely eliminates circular wait.`,
    summary: "Deadlock requires four simultaneous Coffman conditions: Mutual Exclusion, Hold & Wait, No Preemption, and Circular Wait. Invalidation of any single condition (e.g. strict resource ordering to prevent circular wait) guarantees prevention.",
    keyConcepts: [
      "Coffman Conditions",
      "Mutual Exclusion",
      "Hold and Wait",
      "Resource Allocation Graph",
      "Circular Wait Invalidation",
    ],
    weakTopicsIdentified: ["Resource Ordering Hierarchy", "Banker's Algorithm State Check"],
    tags: ["Computer Science", "Operating Systems", "Exam Prep"],
    createdAt: "2026-11-06T09:30:00.000Z",
  },
  {
    _id: "note-2",
    title: "Distributed Systems — CAP Theorem & Eventual Consistency",
    rawContent: `The CAP theorem states that any distributed data store can only provide at most two of the following three guarantees: Consistency (every read receives the most recent write or an error), Availability (every request receives a non-error response without guarantee of latest write), and Partition Tolerance (the system continues to operate despite arbitrary network dropouts).

In real networks, network partitions are inevitable. Therefore, systems must choose between CP (Consistency over Availability, e.g. MongoDB, HBase) and AP (Availability over Consistency with eventual consistency, e.g. Cassandra, DynamoDB).`,
    summary: "In distributed networks where partitions are unavoidable, systems must trade off between strict consistency (CP) or high availability with eventual consistency (AP).",
    keyConcepts: [
      "CAP Theorem",
      "Partition Tolerance",
      "Eventual Consistency",
      "CP vs AP Architecture",
    ],
    weakTopicsIdentified: ["PACELC Theorem Extension"],
    tags: ["Distributed Systems", "Backend Architecture"],
    createdAt: "2026-11-05T14:15:00.000Z",
  },
  {
    _id: "note-3",
    title: "Data Structures — Graph Traversal & Dijkstra Algorithm",
    rawContent: `Dijkstra's algorithm finds the shortest paths from a single source vertex to all other vertices in a weighted graph with non-negative edge weights.
Using a binary min-heap priority queue, its time complexity is O((V + E) log V).
If negative edge weights exist, Dijkstra fails and Bellman-Ford (O(V * E)) must be used instead.`,
    summary: "Dijkstra calculates single-source shortest paths on non-negative weighted graphs in O((V + E) log V) with a priority queue. Negative edges require Bellman-Ford.",
    keyConcepts: [
      "Dijkstra Algorithm",
      "Min-Heap Priority Queue",
      "Edge Relaxation",
      "Bellman-Ford Comparison",
    ],
    weakTopicsIdentified: ["Negative Cycle Detection", "Fibonacci Heap Complexity"],
    tags: ["Algorithms", "Data Structures"],
    createdAt: "2026-11-04T18:00:00.000Z",
  },
];

export const sampleQuiz = {
  _id: "quiz-os-101",
  title: "Operating Systems: Deadlock & Scheduling Diagnostic",
  noteId: "note-1",
  totalQuestions: 4,
  questions: [
    {
      id: "q1",
      questionText: "Which of the following is NOT one of the four Coffman conditions required for a deadlock to occur?",
      options: [
        "Mutual Exclusion",
        "Hold and Wait",
        "Preemptive Resource Allocation",
        "Circular Wait",
      ],
      correctAnswerIndex: 2,
      explanation: "The condition is 'No Preemption', meaning resources cannot be forcibly seized. 'Preemptive Resource Allocation' would actively break deadlock.",
      topicTag: "Coffman Conditions",
    },
    {
      id: "q2",
      questionText: "How can the system definitively invalidate the 'Circular Wait' condition in resource allocation?",
      options: [
        "Disallowing any process from holding more than one resource at a time",
        "Imposing a strict global numerical ordering on all resources and requiring ascending acquisition",
        "Terminating all low-priority processes when resource usage exceeds 80%",
        "Using asynchronous thread pools instead of synchronous locks",
      ],
      correctAnswerIndex: 1,
      explanation: "By defining a global ordering on all resources (R1 < R2 < ... < Rn) and enforcing that processes only request resources in strictly increasing order, circular cycles are mathematically impossible.",
      topicTag: "Circular Wait Invalidation",
    },
    {
      id: "q3",
      questionText: "In Dijkstra's shortest path algorithm with a binary heap, what is the asymptotic runtime complexity?",
      options: [
        "O(V^2)",
        "O((V + E) log V)",
        "O(V * E)",
        "O(E log E + V)",
      ],
      correctAnswerIndex: 1,
      explanation: "With a binary min-heap priority queue, extracting vertices takes O(V log V) and updating edge weights takes O(E log V), yielding O((V + E) log V).",
      topicTag: "Dijkstra Algorithm",
    },
    {
      id: "q4",
      questionText: "Why does standard Dijkstra's algorithm produce incorrect results on graphs with negative edge weights?",
      options: [
        "Because it assumes edge weights represent Euclidean spatial distances",
        "Because once a vertex is marked as visited/finalized, Dijkstra assumes its shortest distance is permanently optimal",
        "Because heaps cannot store negative floating-point numbers",
        "Because it results in an infinite call stack recursion",
      ],
      correctAnswerIndex: 1,
      explanation: "Dijkstra greedily finalizes the shortest distance vertex assuming no subsequent edge can decrease the path weight. A negative edge can retroactively make an alternate route cheaper.",
      topicTag: "Graph Algorithms (Dijkstra vs Bellman-Ford)",
    },
  ],
};
