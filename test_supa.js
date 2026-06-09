const url = 'https://eftsuegjfqgwdrajkloc.supabase.co/rest/v1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdHN1ZWdqZnFnd2RyYWprbG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQ5NDUsImV4cCI6MjA5NDM1MDk0NX0.qjtTRJk7oM3SQf5iat9OzbFmt2-VSneBNZ28TSUDXmE';

async function test() {
  const res1 = await fetch(url + '/cat_productos?select=*&limit=5', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  console.log('cat_productos status:', res1.status);
  if (res1.status === 200) console.log(await res1.json());
  else console.log(await res1.text());
}
test();
