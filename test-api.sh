#!/bin/bash

echo "================================"
echo "Testing Masterdiskon Chat API"
echo "================================"
echo ""

echo "1. Testing Health Check..."
curl -s http://localhost:3000/api/health | python3 -m json.tool
echo -e "\n"

echo "2. Testing Chat - First Message..."
curl -s -X POST http://localhost:3000/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@mail.com","name":"Test User","message":"Halo"}' | python3 -m json.tool
echo -e "\n"

echo "3. Testing Chat - Second Message..."
curl -s -X POST http://localhost:3000/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@mail.com","message":"Apa itu Masterdiskon?"}' | python3 -m json.tool
echo -e "\n"

echo "4. Testing Get History..."
curl -s "http://localhost:3000/api/chat/history?email=testuser@mail.com&limit=10" | python3 -m json.tool
echo -e "\n"

echo "================================"
echo "All tests completed!"
echo "================================"
