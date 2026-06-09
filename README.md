# WIN Messenger 💌

카카오톡 스타일의 실시간 메신저 애플리케이션입니다.
Socket.IO, LangChain, MCP(Model Context Protocol) 기술을 통합하여 AI 어시스턴트가 내장된 채팅 앱입니다.

## 기술 스택

| 기술 | 용도 |
|------|------|
| **Socket.IO** | 실시간 양방향 메시징 |
| **LangChain** | AI 에이전트 오케스트레이션 (하네스) |
| **MCP** | AI 도구 확장 프로토콜 |
| **Express** | HTTP 서버 & 정적 파일 서빙 |
| **Claude API** | AI 언어 모델 (@langchain/anthropic) |

## 프로젝트 구조

```
win_messenger/
├── package.json
├── .env                          # API 키 설정
├── .gitignore
├── README.md
├── server/
│   ├── index.js                  # Express + Socket.IO 서버 진입점
│   ├── socket.js                 # Socket.IO 이벤트 핸들러
│   ├── store.js                  # 인메모리 데이터 저장소
│   └── ai/
│       ├── agent.js              # LangChain ReAct 에이전트 (하네스)
│       └── mcp-server.js         # MCP 도구 서버
└── public/
    ├── index.html                # SPA 메인 HTML
    ├── css/
    │   └── style.css             # 카카오톡 스타일 + 연한 핑크 테마
    └── js/
        └── app.js                # 프론트엔드 앱 로직
```

## 설치 및 실행

### 사전 요구사항
- Node.js 18+
- Anthropic API Key

### 설치

```bash
npm install
```

### 환경변수 설정

`.env` 파일에 API 키를 설정하세요:

```
ANTHROPIC_API_KEY=your_api_key_here
PORT=3000
```

### 실행

```bash
# 프로덕션
npm start

# 개발 (auto-reload)
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 주요 기능

### v1.2.0 - 그룹 채팅 수정 (현재)

- [x] 그룹 채팅방 열기/입장 (`room:open-by-id` 서버 핸들러 추가)
- [x] 그룹 채팅 생성 시 자동 입장 (생성자가 바로 그룹방으로 이동)
- [x] 그룹 채팅방 목록에서 클릭 시 정상 입장
- [x] 그룹 채팅 3인 이상 실시간 메시지 송수신 정상 작동

### v1.1.0 - 다중 사용자 & 뱃지 시스템

- [x] 다중 사용자 실시간 채팅
- [x] 그룹 채팅 생성 (+ 버튼으로 초대)
- [x] 하단 탭 바 실시간 뱃지 카운터 (친구/채팅)
- [x] 새 친구 접속 시 친구 탭 뱃지 + NEW 아이콘 표시
- [x] 읽지 않은 메시지 채팅 탭 뱃지 + 채팅방별 카운트 + NEW 아이콘 표시
- [x] 친구 탭 방문 시 친구 뱃지/NEW 자동 제거
- [x] 채팅방 입장 시 해당 방 읽지 않은 메시지 뱃지 자동 제거
- [x] 실시간 room:notify로 상대방 채팅방 목록 자동 갱신

### v1.0.0 - 기본 채팅

- [x] 실시간 1:1 채팅 (Socket.IO)
- [x] 카카오톡 스타일 UI (친구목록, 채팅방 목록, 채팅)
- [x] 연한 핑크 컬러 테마
- [x] AI 어시스턴트 채팅 (LangChain ReAct Agent)
- [x] MCP 도구 서버 (시간, 날씨, 계산, 번역)
- [x] 타이핑 인디케이터
- [x] 로그인 (닉네임 기반)

## 아키텍처

### 메시징 흐름

```
[사용자 A] → Socket.IO → [서버] → Socket.IO → [사용자 B]
```

### AI 에이전트 흐름 (LangChain + MCP)

```
[사용자] → Socket.IO → [서버]
                          ↓
                    [LangChain Agent] (하네스: 에이전트 생명주기 관리)
                          ↓
                    [MCP Client] ←→ [MCP Server] (stdio 전송)
                          ↓                ↓
                    [Claude API]     [도구: 시간/날씨/계산/번역]
                          ↓
                    [AI 응답] → Socket.IO → [사용자]
```

### 하네스 (Harness) 패턴

`server/ai/agent.js`가 하네스 역할을 합니다:
- **initAgent()**: 에이전트 초기화 (MCP 클라이언트 연결, 도구 로드, ReAct 에이전트 생성)
- **invokeAgent()**: 에이전트 호출 (대화 히스토리 관리, 메시지 전달, 응답 반환)
- **shutdownAgent()**: 에이전트 종료 (MCP 연결 정리)

### MCP 도구 서버

`server/ai/mcp-server.js`는 독립 프로세스로 실행되며, stdio 전송을 통해 LangChain 에이전트와 통신합니다:

| 도구 | 설명 |
|------|------|
| `get_current_time` | 현재 한국 시간 반환 |
| `get_weather` | 도시별 날씨 정보 (mock) |
| `calculate` | 수학 계산 수행 |
| `translate_hint` | 번역 힌트 제공 |

## Socket.IO 이벤트

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `user:login` | Client → Server | 로그인 요청 |
| `user:logged-in` | Server → Client | 로그인 성공 (유저/친구/채팅방 정보) |
| `room:open` | Client → Server | 채팅방 열기 |
| `room:joined` | Server → Client | 채팅방 입장 (메시지 히스토리) |
| `message:send` | Client → Server | 메시지 전송 |
| `message:new` | Server → Client | 새 메시지 수신 |
| `ai:typing` | Server → Client | AI 응답 생성 중 |
| `typing:start/stop` | 양방향 | 타이핑 상태 |

## 디자인

- 메인 컬러: 연한 핑크 (#FFB6C1)
- 액센트: 핫 핑크 (#FF69B4)
- 내 메시지: 미디엄 핑크 (#FF85A2)
- 채팅 배경: 라벤더 블러시 (#FFF0F5)
- AI 메시지: 연한 보라 (#F0E6FF)
- 모바일 퍼스트, 420px 고정 폭 레이아웃

## 작업 내역

### 2026-06-09: v1.2.0 - 그룹 채팅 버그 수정
- `room:open-by-id` 서버 핸들러 추가 (`server/socket.js`) - 그룹 채팅방 ID로 직접 열기
- `room:create-group` 시 생성자 소켓을 Socket.IO 룸에 자동 조인
- 클라이언트 채팅방 목록 클릭 핸들러 수정 (`public/js/app.js`) - 그룹방은 `room:open-by-id`로 열기
- 그룹 생성 후 자동으로 해당 그룹방 입장 (`pendingGroupOpen` 플래그)
- 3인 그룹 채팅 실시간 메시지 송수신 테스트 완료

### 2026-06-09: v1.1.0 - 다중 사용자 & 뱃지 시스템
- 다중 사용자 동시 채팅 지원 (`server/socket.js` 전면 개편)
- 그룹 채팅방 생성 기능 추가 (`store.js` - `createGroupRoom`)
- 읽지 않은 메시지 추적 시스템 (`store.js` - `unreadCounts`)
- 새 친구 추적 시스템 (`store.js` - `newFriends`)
- 하단 탭 바 실시간 뱃지 카운터 (`index.html` - `.tab-badge`)
- NEW 아이콘 표시 (친구 목록, 채팅방 목록)
- 뱃지 자동 제거: 친구 탭 방문 시 / 채팅방 입장 시
- `room:notify` 이벤트로 상대방 채팅방 목록 실시간 갱신
- `badges:update` 이벤트로 뱃지 실시간 동기화
- CSS에 뱃지 애니메이션 (`badgePop`) 추가

### 2026-06-09: v1.0.0 - 프로젝트 초기 구축
- 프로젝트 구조 설계 및 생성
- Express + Socket.IO 서버 구현 (`server/index.js`)
- Socket.IO 이벤트 핸들러 구현 (`server/socket.js`)
- 인메모리 데이터 저장소 구현 (`server/store.js`)
- LangChain ReAct 에이전트 하네스 구현 (`server/ai/agent.js`)
- MCP 도구 서버 구현 (`server/ai/mcp-server.js`)
- 카카오톡 스타일 프론트엔드 구현 (`public/index.html`, `public/css/style.css`)
- 프론트엔드 앱 로직 구현 (`public/js/app.js`)
- 연한 핑크 테마 적용
- README.md 작성
