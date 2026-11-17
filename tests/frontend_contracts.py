"""Exercise the real API contracts used by the frontend using disposable local data.
Run: python tests/frontend_contracts.py (from the repository root).
No model, research, audio, or desktop success is mocked.
"""
import os
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient

with tempfile.TemporaryDirectory(prefix='jarvis-contract-data-') as data, tempfile.TemporaryDirectory(prefix='jarvis-contract-workspace-') as workspace:
    os.environ['JARVIS_DATA_DIR']=data
    os.environ['JARVIS_WORKSPACE']=workspace
    from backend.main import app
    from backend import agent, memory
    checks=[]
    def check(client, method, path, expected=200, **kwargs):
        response=getattr(client,method)(path,**kwargs)
        assert response.status_code==expected,(path,response.status_code,response.text[:300])
        checks.append((method,path,expected))
        return response
    with TestClient(app) as client:
        for path in ['health','voice/status','memory/status','coding/status','research/status','agent/status','memory/conversations','agent/approvals','agent/windows/proposals']:
            check(client,'get','/api/'+path)
        check(client,'post','/api/coding/inspect',json={'path':'backend','max_files':5})
        check(client,'post','/api/coding/diagnose',json={'path':'backend/main.py'})
        check(client,'post','/api/coding/search',json={'path':'backend','query':'async','max_matches':4})
        diff=check(client,'post','/api/coding/diff',json={'path':'backend/main.py','proposed_content':'print("preview only")\n'}).json()
        assert diff['applied'] is False and diff['approval_required'] is True
        proposal=agent.run_tool('propose_write',{'path':'approved.txt','content':'Disposable contract test','reason':'Test fixture'})
        aid=proposal['approval_id']
        check(client,'get','/api/agent/approvals/'+aid)
        check(client,'post','/api/agent/approvals/'+aid+'/approve',json={})
        assert Path(workspace,'approved.txt').read_text()=='Disposable contract test'
        check(client,'post','/api/agent/approvals/'+aid+'/approve',409,json={})
        rejected=agent.run_tool('propose_write',{'path':'rejected.txt','content':'Never written','reason':'Test fixture'})
        check(client,'post','/api/agent/approvals/'+rejected['approval_id']+'/reject',json={})
        assert not Path(workspace,'rejected.txt').exists()
        cid=str(uuid.uuid4());now=datetime.now(timezone.utc).isoformat()
        with memory.connect() as con:
            con.execute('INSERT INTO conversations VALUES (?,?)',(cid,now))
            con.execute('INSERT INTO messages(conversation_id,role,content,created_at) VALUES (?,?,?,?)',(cid,'user','Disposable memory fixture',now));con.commit()
        check(client,'get','/api/memory/conversations/'+cid)
        check(client,'delete','/api/memory/conversations/'+cid)
        check(client,'get','/api/memory/conversations/'+cid,404)
        result=check(client,'post','/api/agent/chat',json={'message':'Open calculator','history':[]}).json()
        assert result['events'][0]['result']['status']=='pending_approval'
        assert 'Nothing has been opened' in result['response']
        followup=check(client,'post','/api/agent/chat',json={'message':'yes do it','history':[]}).json()
        assert 'Nothing has been executed' in followup['response']
        check(client,'post','/api/voice/transcribe',400,files={'file':('empty.wav',b'','audio/wav')})
        check(client,'post','/api/voice/converse',400,files={'file':('empty.wav',b'','audio/wav')},data={'history':'[]'})
        check(client,'post','/api/chat',422,json={'message':'','history':[]})
        check(client,'post','/api/research/search',422,json={'query':'x'})
    print(f'PASS: {len(checks)} real FastAPI contract checks; all writes confined to temporary fixtures.')
    print('Not covered: real model generation, speech model output, microphone hardware, live research or Windows execution.')
