# Minigame Refactor - Testing Guide

## What Was Refactored

### Backend Changes
1. **Schema**: Changed from `game_types: list` → `game_type: single` in GenerateMinigameRequest
2. **Generator**: Split into 3 specialized generators
   - `quiz_mixed`: 10 questions mixing true/false, MCQ, multi-select, fill-blank
   - `flashcard`: 10 flashcard pairs for spaced repetition
   - `scenario_branching`: 3-5 scenario trees with branching choices
3. **Scoring**: Game-type specific logic
   - Quiz: Direct answer matching (case-insensitive, handles multi-select)
   - Flashcard: Any answer = correct (self-study mode)
   - Scenario: Path-based scoring with impact points + skill extraction

### Frontend Changes
1. **New Player Components**:
   - `QuizMixedPlayer.tsx`: Renders 4 question types, shows explanations
   - `FlashcardPlayer.tsx`: Flip cards, swipe to mark known/unknown
   - `ScenarioPlayer.tsx`: Branching decision tree with feedback
2. **Minigame Page**: Now shows game type selector before playing
3. **Material Page**: Navigate to minigame page (user selects type there)

## How to Test

### 1. Start Backend Server
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
Monitor output - should see:
- ✅ "Connected MongoDB"
- ✅ "Application startup complete"

### 2. Start Frontend Dev Server
```bash
cd frontend
npm run dev
```
Should run on http://localhost:3000

### 3. Test Flow for Each Game Type

#### Quiz Mixed
1. Go to Materials page
2. Select a material
3. Click "Tạo Minigame"
4. Select "Trắc nghiệm hỗn hợp"
5. See 10 mixed questions (mix of true/false, MCQ, multi-select, fill-blank)
6. Answer all questions
7. Click "Nộp bài"
8. See score and explanation for each question

**Expected**: Score = number of correct answers / 10

#### Flashcard
1. Repeat steps 1-4 above, choose "Flashcard"
2. See large flip cards with terms on one side
3. Click card to flip and see definition
4. Click "Biết rồi" (green) or "Chưa biết" (red)
5. Continue until all cards marked
6. See mastery percentage

**Expected**: Mastery % = (known count / 10) * 100

#### Scenario Branching
1. Repeat steps 1-4, choose "Game nhập vai"
2. See scenario description and multiple choice options
3. Choose an option and see immediate feedback
4. Scenario branches to next node (or end)
5. After finishing one scenario, move to next
6. After all scenarios, see final score, skills gained, improvement tips

**Expected**: Score accumulates from choices (positive=+5, neutral=+2, negative=0) + end node bonus

### 4. Check Database Results

After submitting a game, check MongoDB game_attempts collection:
```javascript
db.game_attempts.find({}).pretty()
```

Should show:
- `id`: Attempt ID
- `game_type`: "quiz_mixed", "flashcard", or "scenario_branching"
- `score` & `max_score`: Numeric
- `feedback`: Array of feedback per question/scenario
- `skills_gained`: Array (empty for quiz/flashcard, populated for scenario)
- `improvement_tips`: Array (empty for quiz/flashcard, populated for scenario)

## Known Limitations

1. **Scenario Scoring**: Max score calculation might not perfectly match all paths
   - Currently: max_score = len(scenarios) * 10
   - TODO: Accumulate from all possible end nodes
2. **LLM Generation**: Depends on LLMClient, fallback data is basic
3. **Frontend**: Scenario branching not fully tested with real deep trees (3+ levels)

## Files Changed

### Backend
- `schemas/generated_content.py` - Changed to single game_type
- `schemas/games.py` - Added game_type, skills_gained, improvement_tips to response
- `services/generation_service.py` - Updated to pass game_type
- `services/game_service.py` - Complete rewrite with 3 scoring methods
- `ai/generation/minigame_generator.py` - 3 specialized generators
- `api/routes/generated_contents.py` - Updated request handling

### Frontend
- `app/materials/[id]/minigame/page.tsx` - Added game selector + player routing
- `components/minigame/QuizMixedPlayer.tsx` - NEW
- `components/minigame/FlashcardPlayer.tsx` - NEW
- `components/minigame/ScenarioPlayer.tsx` - NEW
- `lib/api.ts` - Updated generateMinigame & submitGameAttempt signatures
- `types/index.ts` - Added game_type to GeneratedContent
- `app/materials/[id]/page.tsx` - Modified to navigate to minigame selector

## Next Steps for Production

1. Enhance scenario max_score calculation
2. Add unit tests for scoring logic
3. Performance test with 100+ items
4. Scenario branching depth limit (prevent infinite loops)
5. Add analytics tracking (completion rate, average score per game type)
6. Mobile responsiveness for flashcard swipe
7. Accessibility improvements (keyboard navigation for scenario choices)
