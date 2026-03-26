#!/usr/bin/env python3
"""
Minigame Refactor - Basic Integration Test
Tests the new 3-game-type architecture
"""

import asyncio
import json
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.config import settings
from app.services.generation_service import GenerationService
from app.services.game_service import GameService
from bson import ObjectId

async def test_minigame_flow():
    """Test generate & score for each game type"""
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]
    
    try:
        # Get or create test material
        material = await db.learning_materials.find_one()
        if not material:
            print("❌ No material found. Run seed script first: python -m scripts.seed")
            return False
        
        material_id = str(material['_id'])
        print(f"✅ Found material: {material.get('title')} (ID: {material_id})")
        
        # Ensure material is processed
        if material.get('processing_status') != 'processed':
            await db.learning_materials.update_one(
                {'_id': material['_id']},
                {'$set': {'processing_status': 'processed', 'cleaned_text': material.get('raw_text', 'Test content')}}
            )
            print("✅ Updated material status to processed")
        
        gen_service = GenerationService(db)
        game_service = GameService(db)
        
        # Test 1: Generate quiz_mixed
        print("\n🎮 Test 1: Quiz Mixed Generation")
        try:
            quiz_content = await gen_service.generate_minigame(material_id, game_type="quiz_mixed")
            assert quiz_content.get('game_type') == 'quiz_mixed', "game_type not saved"
            assert quiz_content.get('json_content', {}).get('type') == 'quiz_mixed', "Content type mismatch"
            assert len(quiz_content.get('json_content', {}).get('items', [])) > 0, "No items generated"
            print(f"✅ Quiz generated with {len(quiz_content['json_content']['items'])} items")
            
            # Test scoring
            answers = [
                {'id': item['id'], 'answer': item.get('options', ['A'])[0] if item.get('options') else 'A'}
                for item in quiz_content['json_content']['items'][:3]
            ]
            attempt = await game_service.submit_attempt(quiz_content['id'], 'test-user', answers)
            assert 'score' in attempt, "No score in attempt"
            print(f"✅ Quiz scored: {attempt['score']}/{attempt['max_score']}")
        except Exception as e:
            print(f"❌ Quiz test failed: {e}")
            return False
        
        # Test 2: Generate flashcard
        print("\n🎮 Test 2: Flashcard Generation")
        try:
            flashcard_content = await gen_service.generate_minigame(material_id, game_type="flashcard")
            assert flashcard_content.get('game_type') == 'flashcard', "game_type not saved"
            assert flashcard_content.get('json_content', {}).get('type') == 'flashcard', "Content type mismatch"
            assert len(flashcard_content.get('json_content', {}).get('items', [])) > 0, "No items generated"
            print(f"✅ Flashcard generated with {len(flashcard_content['json_content']['items'])} items")
            
            # Test scoring
            answers = [
                {'id': item['id'], 'answer': 'remembered'}
                for item in flashcard_content['json_content']['items'][:2]
            ]
            attempt = await game_service.submit_attempt(flashcard_content['id'], 'test-user', answers)
            assert 'score' in attempt, "No score in attempt"
            print(f"✅ Flashcard scored: {attempt['score']}/{attempt['max_score']}")
        except Exception as e:
            print(f"❌ Flashcard test failed: {e}")
            return False
        
        # Test 3: Generate scenario
        print("\n🎮 Test 3: Scenario Generation")
        try:
            scenario_content = await gen_service.generate_minigame(material_id, game_type="scenario_branching")
            assert scenario_content.get('game_type') == 'scenario_branching', "game_type not saved"
            assert scenario_content.get('json_content', {}).get('type') == 'scenario_branching', "Content type mismatch"
            scenarios = scenario_content.get('json_content', {}).get('scenarios', [])
            assert len(scenarios) > 0, "No scenarios generated"
            print(f"✅ Scenario generated with {len(scenarios)} scenarios")
            
            # Create mock answers for scenario (simplified)
            answers = []
            for scenario in scenarios[:1]:
                root_id = scenario.get('root_node_id', '')
                if root_id:
                    nodes = {n['id']: n for n in scenario.get('nodes', [])}
                    if root_id in nodes:
                        node = nodes[root_id]
                        choices = node.get('choices', [])
                        if choices:
                            answers.append({'node_id': root_id, 'answer': choices[0]['id']})
            
            if answers:
                attempt = await game_service.submit_attempt(scenario_content['id'], 'test-user', answers)
                assert 'score' in attempt, "No score in attempt"
                print(f"✅ Scenario scored: {attempt['score']}/{attempt['max_score']}")
                if attempt.get('skills_gained'):
                    print(f"   Skills gained: {', '.join(attempt['skills_gained'])}")
        except Exception as e:
            print(f"❌ Scenario test failed: {e}")
            return False
        
        print("\n✅ All tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test setup failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()

if __name__ == "__main__":
    result = asyncio.run(test_minigame_flow())
    sys.exit(0 if result else 1)
