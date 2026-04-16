#!/usr/bin/env python3
"""
Sample Data Generator for Grafana Dashboards
Generates sample metrics for testing Grafana dashboards without real application
"""

import random
import time
from datetime import datetime
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import threading

# Define metrics matching our dashboards
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status', 'service']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'service'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

ai_generation_requests_total = Counter(
    'ai_generation_requests_total',
    'Total AI generation requests',
    ['generation_type', 'model', 'status']
)

ai_generation_duration_seconds = Histogram(
    'ai_generation_duration_seconds',
    'AI generation duration in seconds',
    ['generation_type', 'model'],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0)
)

chat_messages_total = Counter(
    'chat_messages_total',
    'Total chat messages',
    ['user_type']
)

materials_uploaded_total = Counter(
    'materials_uploaded_total',
    'Total materials uploaded',
    ['file_type']
)

active_users = Gauge(
    'active_users',
    'Number of currently active users'
)

# Configuration
ENDPOINTS = [
    '/api/materials',
    '/api/generate/quiz',
    '/api/generate/lesson-plan',
    '/api/chat/message',
    '/api/user/profile',
    '/api/health'
]

GENERATION_TYPES = ['quiz', 'lesson_plan', 'flashcard', 'summary', 'presentation']
AI_MODELS = ['gemini', 'gpt-4o-mini', 'claude']
FILE_TYPES = ['pdf', 'docx', 'pptx', 'txt', 'image']

def generate_http_traffic():
    """Generate random HTTP traffic"""
    while True:
        # Random request
        method = random.choice(['GET', 'POST', 'PUT', 'DELETE'])
        endpoint = random.choice(ENDPOINTS)
        service = 'backend'
        
        # 95% success rate
        status = '200' if random.random() < 0.95 else random.choice(['400', '404', '500', '503'])
        
        # Random duration (faster for GET, slower for POST)
        if method == 'GET':
            duration = random.uniform(0.01, 0.5)
        else:
            duration = random.uniform(0.1, 2.0)
        
        # Record metrics
        http_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status=status,
            service=service
        ).inc()
        
        http_request_duration_seconds.labels(
            method=method,
            endpoint=endpoint,
            service=service
        ).observe(duration)
        
        # Delay between requests
        time.sleep(random.uniform(0.1, 1.0))

def generate_ai_activity():
    """Generate random AI generation activity"""
    while True:
        generation_type = random.choice(GENERATION_TYPES)
        model = random.choice(AI_MODELS)
        
        # 90% success rate
        status = 'success' if random.random() < 0.9 else 'error'
        
        # Random duration (2-30 seconds for AI)
        duration = random.uniform(2.0, 30.0)
        
        # Record metrics
        ai_generation_requests_total.labels(
            generation_type=generation_type,
            model=model,
            status=status
        ).inc()
        
        ai_generation_duration_seconds.labels(
            generation_type=generation_type,
            model=model
        ).observe(duration)
        
        # Delay between generations
        time.sleep(random.uniform(5.0, 15.0))

def generate_user_activity():
    """Generate random user activity"""
    while True:
        # Chat messages
        if random.random() < 0.3:
            chat_messages_total.labels(user_type='student').inc()
        
        # Material uploads
        if random.random() < 0.1:
            file_type = random.choice(FILE_TYPES)
            materials_uploaded_total.labels(file_type=file_type).inc()
        
        # Active users (fluctuate between 5-50)
        active_count = random.randint(5, 50)
        active_users.set(active_count)
        
        time.sleep(random.uniform(1.0, 5.0))

def main():
    print("🚀 Starting Sample Data Generator...")
    print("📊 Metrics will be available at: http://localhost:8001/metrics")
    print("⏱️  Generating data continuously...")
    print("Press Ctrl+C to stop\n")
    
    # Start metrics server
    start_http_server(8001)
    
    # Start data generation threads
    threads = [
        threading.Thread(target=generate_http_traffic, daemon=True),
        threading.Thread(target=generate_ai_activity, daemon=True),
        threading.Thread(target=generate_user_activity, daemon=True),
    ]
    
    for thread in threads:
        thread.start()
    
    # Keep main thread alive
    try:
        while True:
            # Print stats every 10 seconds
            time.sleep(10)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Generating sample data...")
    except KeyboardInterrupt:
        print("\n\n👋 Stopping data generator...")

if __name__ == '__main__':
    main()
