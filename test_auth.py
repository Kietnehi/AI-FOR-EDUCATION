import requests

s = requests.Session()
# Login
print("Attempting login...")
resp = s.post('http://localhost:8000/api/auth/google/login', json={'id_token':'test_token'})
print("Login status:", resp.status_code)
print("Login body:", resp.json())
print("Cookies:", s.cookies.get_dict())

# Get Me
print("\nFetching /api/auth/me...")
resp2 = s.get('http://localhost:8000/api/auth/me')
print("Me status:", resp2.status_code)
print("Me body:", resp2.json())

# Fetch Materials (protected)
print("\nFetching /api/materials...")
resp3 = s.get('http://localhost:8000/api/materials')
print("Materials status:", resp3.status_code)
print("Materials info:", type(resp3.json()), resp3.json())
