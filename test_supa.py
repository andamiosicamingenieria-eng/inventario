import urllib.request
import json

url = 'https://eftsuegjfqgwdrajkloc.supabase.co/rest/v1/contratos?select=*&limit=5'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdHN1ZWdqZnFnd2RyYWprbG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQ5NDUsImV4cCI6MjA5NDM1MDk0NX0.qjtTRJk7oM3SQf5iat9OzbFmt2-VSneBNZ28TSUDXmE'

req = urllib.request.Request(url, headers={'apikey': key, 'Authorization': 'Bearer ' + key})
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Error:", e.code, e.read().decode('utf-8'))
