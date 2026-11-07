import SkillTree from '../models/SkillTree.js';
import LearningDNA from '../models/LearningDNA.js';
import Note from '../models/Note.js';
import { generateBossChallenge } from '../services/geminiService.js';

// Default pedagogical skill tree graph structure
const DEFAULT_SKILL_NODES = [
  {
    nodeId: 'node-core',
    label: 'Computational Foundations & Invariants',
    status: 'Mastered',
    parentId: null,
    category: 'Foundations',
  },
  {
    nodeId: 'node-os',
    label: 'Operating Systems & Concurrency',
    status: 'Unlocked',
    parentId: 'node-core',
    category: 'Systems',
  },
  {
    nodeId: 'node-ds',
    label: 'Data Structures & Algorithms',
    status: 'Unlocked',
    parentId: 'node-core',
    category: 'Algorithms',
  },
  {
    nodeId: 'node-deadlock',
    label: 'Deadlock Prevention & Coffman Invariants',
    status: 'Locked',
    parentId: 'node-os',
    category: 'Systems',
  },
  {
    nodeId: 'node-graphs',
    label: 'Graph Traversal & Dijkstra Shortest Path',
    status: 'Locked',
    parentId: 'node-ds',
    category: 'Algorithms',
  },
  {
    nodeId: 'node-dist',
    label: 'Distributed Systems & CAP Theorem',
    status: 'Locked',
    parentId: 'node-deadlock',
    category: 'Systems',
  },
  {
    nodeId: 'node-dp',
    label: 'Dynamic Programming & Memoization',
    status: 'Locked',
    parentId: 'node-graphs',
    category: 'Algorithms',
  },
];

/**
 * @desc    Get or initialize user's RPG Skill Tree & Boss Battle records
 * @route   GET /api/boss/skill-tree
 * @access  Private
 */
export const getSkillTree = async (req, res) => {
  try {
    const userId = req.user._id;

    let skillTree = await SkillTree.findOne({ userId });
    const dna = await LearningDNA.findOne({ userId });

    if (!skillTree) {
      skillTree = await SkillTree.create({
        userId,
        nodes: DEFAULT_SKILL_NODES,
        bossHistory: [],
        unlockedBadges: [
          {
            badgeId: 'badge-initiate',
            title: 'Knowledge Initiate',
            description: 'Entered the LearnLens cognitive arena',
            icon: 'Shield',
            unlockedAt: new Date(),
          },
        ],
      });
    }

    // Sync node statuses with student's current Learning DNA
    if (dna) {
      let isModified = false;
      const strongLower = (dna.strongTopics || []).map((t) => t.toLowerCase());

      // Master nodes if learner has demonstrated mastery
      skillTree.nodes.forEach((node) => {
        const matchesStrong = strongLower.some((s) => node.label.toLowerCase().includes(s));
        if (matchesStrong && node.status !== 'Mastered') {
          node.status = 'Mastered';
          isModified = true;

          // Unlock children of mastered node
          skillTree.nodes.forEach((child) => {
            if (child.parentId === node.nodeId && child.status === 'Locked') {
              child.status = 'Unlocked';
            }
          });
        }
      });

      if (isModified) {
        await skillTree.save();
      }
    }

    return res.status(200).json({
      success: true,
      skillTree,
    });
  } catch (error) {
    console.error(`[Skill Tree Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching skill tree',
    });
  }
};

/**
 * @desc    Generate a timed 10-question Boss Fight challenge targeting weak topics
 * @route   POST /api/boss/challenge
 * @access  Private
 */
export const generateBossFight = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Gather all student weak topics across DNA and Notes
    const [dna, notes, skillTree] = await Promise.all([
      LearningDNA.findOne({ userId }),
      Note.find({ userId }).select('weakTopicsIdentified'),
      SkillTree.findOne({ userId }),
    ]);

    const weakSet = new Set();

    if (dna && Array.isArray(dna.weakTopics)) {
      dna.weakTopics.forEach((t) => weakSet.add(t));
    }
    if (dna && Array.isArray(dna.knowledgeGaps)) {
      dna.knowledgeGaps.forEach((g) => weakSet.add(typeof g === 'string' ? g : g.topic));
    }
    notes.forEach((n) => {
      if (Array.isArray(n.weakTopicsIdentified)) {
        n.weakTopicsIdentified.forEach((wt) => weakSet.add(wt));
      }
    });

    const aggregateWeak = Array.from(weakSet);

    // 2. Call Gemini service to synthesize 10-question Boss Battle
    const bossChallenge = await generateBossChallenge(aggregateWeak);

    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 3. Save active boss battle in SkillTree model
    let targetTree = skillTree;
    if (!targetTree) {
      targetTree = new SkillTree({ userId, nodes: DEFAULT_SKILL_NODES });
    }

    targetTree.activeBossFight = {
      battleId,
      bossTitle: bossChallenge.bossTitle,
      bossSubtitle: bossChallenge.bossSubtitle,
      bossLore: bossChallenge.bossLore,
      bossHealth: bossChallenge.bossHealth || 100,
      timeLimitSeconds: bossChallenge.timeLimitSeconds || 300,
      questions: bossChallenge.questions,
      createdAt: new Date(),
    };

    await targetTree.save();

    // 4. Return sanitized payload to client (exclude answers and explanations)
    const sanitizedQuestions = bossChallenge.questions.map((q, idx) => ({
      questionIndex: idx,
      questionText: q.questionText,
      options: q.options,
      topicTag: q.topicTag,
      damage: q.damage || 10,
    }));

    return res.status(201).json({
      success: true,
      message: 'Boss Fight Challenge generated successfully',
      battle: {
        battleId,
        bossTitle: bossChallenge.bossTitle,
        bossSubtitle: bossChallenge.bossSubtitle,
        bossLore: bossChallenge.bossLore,
        bossHealth: 100,
        playerHealth: 100,
        timeLimitSeconds: bossChallenge.timeLimitSeconds || 300,
        totalQuestions: sanitizedQuestions.length,
        questions: sanitizedQuestions,
      },
    });
  } catch (error) {
    console.error(`[Generate Boss Fight Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating Boss Fight',
    });
  }
};

/**
 * @desc    Evaluate Boss Battle submission, calculate damage, award badges, and unlock skill nodes
 * @route   POST /api/boss/submit
 * @access  Private
 */
export const evaluateBossBattle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { battleId, answers } = req.body; // Expects answers: [{ questionIndex, selectedOptionIndex }]

    if (!battleId || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid battleId and array of answers',
      });
    }

    const skillTree = await SkillTree.findOne({ userId });

    if (!skillTree || !skillTree.activeBossFight) {
      return res.status(404).json({
        success: false,
        message: 'No active Boss Fight found or battle expired',
      });
    }

    const activeFight = skillTree.activeBossFight;

    if (activeFight.battleId !== battleId) {
      return res.status(400).json({
        success: false,
        message: 'Battle ID mismatch with active challenge session',
      });
    }

    let damageDealt = 0;
    let correctCount = 0;
    const totalQuestions = activeFight.questions.length;
    const detailedReview = [];

    // Evaluate answers against activeFight questions
    activeFight.questions.forEach((q, idx) => {
      const userAns = answers.find((a) => a.questionIndex === idx);
      const selectedIndex = userAns !== undefined ? Number(userAns.selectedOptionIndex) : null;
      const isCorrect = selectedIndex !== null && selectedIndex === q.correctAnswerIndex;

      if (isCorrect) {
        correctCount += 1;
        damageDealt += q.damage || 10;
      }

      detailedReview.push({
        questionIndex: idx,
        questionText: q.questionText,
        options: q.options,
        selectedOptionIndex: selectedIndex,
        correctAnswerIndex: q.correctAnswerIndex,
        isCorrect,
        explanation: q.explanation,
        topicTag: q.topicTag,
      });
    });

    const bossRemainingHp = Math.max(0, 100 - damageDealt);
    const isVictory = damageDealt >= 70; // 70%+ damage slays the boss

    let awardedBadge = null;
    const newlyUnlockedNodes = [];

    if (isVictory) {
      // 1. Award Legendary Boss Slayer Badge
      awardedBadge = {
        badgeId: `badge-slayer-${Date.now()}`,
        title: `${activeFight.bossTitle} Slayer`,
        description: `Successfully defeated ${activeFight.bossTitle} with ${damageDealt}% damage`,
        icon: 'Crown',
        unlockedAt: new Date(),
      };

      skillTree.unlockedBadges.push(awardedBadge);

      // 2. Unlock the next Locked node in the skill tree
      const nextLockedIndex = skillTree.nodes.findIndex((n) => n.status === 'Locked');
      if (nextLockedIndex !== -1) {
        skillTree.nodes[nextLockedIndex].status = 'Unlocked';
        newlyUnlockedNodes.push(skillTree.nodes[nextLockedIndex]);
      }

      // Also promote an Unlocked node to Mastered
      const unlockedIndex = skillTree.nodes.findIndex((n) => n.status === 'Unlocked');
      if (unlockedIndex !== -1) {
        skillTree.nodes[unlockedIndex].status = 'Mastered';
        // Unlock its children
        skillTree.nodes.forEach((n) => {
          if (n.parentId === skillTree.nodes[unlockedIndex].nodeId && n.status === 'Locked') {
            n.status = 'Unlocked';
            newlyUnlockedNodes.push(n);
          }
        });
      }

      // 3. Boost student's Exam Readiness Score in Learning DNA
      await LearningDNA.findOneAndUpdate(
        { userId },
        {
          $inc: { examReadinessScore: 5 },
          $set: { lastUpdated: new Date() },
        }
      );
    }

    // 4. Record in boss battle history
    skillTree.bossHistory.unshift({
      bossTitle: activeFight.bossTitle,
      scoreAchieved: correctCount,
      damageDealt,
      defeatedAt: new Date(),
      badgeAwarded: isVictory ? awardedBadge?.title : null,
    });

    // 5. Clear active fight
    skillTree.activeBossFight = null;
    await skillTree.save();

    return res.status(200).json({
      success: true,
      isVictory,
      bossTitle: activeFight.bossTitle,
      score: correctCount,
      totalQuestions,
      damageDealt,
      bossRemainingHp,
      awardedBadge,
      newlyUnlockedNodes,
      detailedReview,
    });
  } catch (error) {
    console.error(`[Evaluate Boss Battle Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while evaluating Boss Battle',
    });
  }
};
