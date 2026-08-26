# M360 Customer API — 실제로 호출해서 확인한 것 (2026-08-26)

문서: https://m360soft.com/documents/customer-api
**아래 응답 형태는 실제 호출(테스트 모드)로 확인했다.** 추측이 아니다.

---

## 1. 호출 방법

```
POST https://m360soft.com/api/customer/v2/{엔드포인트}
Content-Type: application/json
Authorization: Bearer {인증코드}-{Auth-Token}
```

⚠️⚠️ **베어러 토큰 = 「인증 코드」 + `-` + 「Auth-Token」**
대시보드에 인증 코드는 그대로 보이고 Auth-Token 은 가려져 있다
(보려면 M360 로그인 비밀번호가 필요하다). **둘 다 있어야 인증된다.**

⚠️⚠️ **절대로 브라우저에서 직접 부르지 마라.**
   업무프로그램은 클라이언트 앱이라, 거기서 부르면 토큰이 번들에 박혀 누구나 본다.
   → **Cloud Function 을 하나 만들어 대신 부르게 한다.** 토큰은 `functions/.env` 에만.

```
M360_AUTH_CODE=...
M360_AUTH_TOKEN=...
M360_TESTING=true      # 개발 중에는 true. 실제로 붙일 때 false
```

## 2. 테스트 모드

- 요청 본문에 `testing: true` → **그 호출만** 가짜 응답. 계정 상태와 무관하게 동작
- 가짜지만 형식은 진짜와 같다. 데이터 변경 없음
- 계정 API 상태를 Testing 으로 두면 전체가 가짜가 된다 (지금 그 상태)

## 3. getHistory — 응답 형태 (실측)

```
POST /api/customer/v2/getHistory
요청 예: { "limit": 3, "order": "connectionTime:desc", "testing": true }
```

```jsonc
{
  "data": {
    "records": [ { ...아래 90개 필드... } ],
    "hasMore": false,      // 다음 쪽이 있는가
    "totalCount": null     // ⚠️ null 로 온다. 총 건수를 믿지 마라
  },
  "meta": { ... }
}
```

### 요청 파라미터 (전부 선택)

| 이름 | 설명 |
|---|---|
| `order` | `id:desc` / `id:asc` / `connectionTime:desc` / `connectionTime:asc` |
| `limit` | 기본 20, 1–100 |
| `startingAfter` / `endingBefore` | 쪽 넘김 (레코드 ID, 36자) |
| `sessionId` | 세션 ID (36자) |
| `imei` / `serial` / `m360id` / `customId` | 배열 또는 문자열, 최대 10개 |
| `friendlyName` | 3–100자 |
| `username` | **M360 사용자명으로 거르기** |
| `testing` | true 면 이 호출만 테스트 |

### 1단계에서 쓸 필드

| 필드 | 실측 예시 | 쓰임 |
|---|---|---|
| `imei` | `"990000862471854"` | ⭐ 목표 |
| `imei2` | `"351756051523999"` | 듀얼심 |
| `sessionId` | `"1a3be5f5-dedd-..."` | 세션 지목 |
| `connectionTime` | `"2026-08-26T05:14:12+00:00"` | 검사 시각 (최근순 정렬) |
| `username` | `"dda465"` | 누가 검사했나 |
| `friendlyName` | `"iPhone 15 Pro Max 256 GB Space Gray"` | ⭐ 모델+용량+색상 한 줄 — 목록에 그대로 쓰면 된다 |
| `marketingName` / `modelName` | `"iPhone 15 Pro Max"` | 모델명 |
| `m360id` | `"AS4MPL3S4MPL3S4MPL3S"` | M360 화면에 보이는 번호 |
| `isClosed` | `true` | 닫힌 세션만 목록에 낸다 |

⚠️ 기기 식별에 실패하면 `device` 가 비고 `imei` 가 null 일 수 있다. **null 을 거르고 보여라.**

### ⚠️⚠️ 시각은 전부 UTC 다 — 반드시 한국시간으로 바꿔서 보여라

`connectionTime` · `createdAt` 이 `2026-08-26T05:15:12+00:00` 꼴로 온다.
**한국시간보다 9시간 이르다.** 그대로 화면에 뿌리면 오후 2시에 검사한 건이
오전 5시로 보인다. 「방금 검사한 것」을 찾아야 하는 화면인데 그러면 못 찾는다.

M360 대시보드 화면도 UTC 로 표시한다 (2026-08-26 실측 — 계정 생성 시각이
한국시간 오후 1:54 인데 화면에는 「오전 4:54」로 나온다).

```js
new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short'
}).format(new Date(rec.connectionTime))
```

⚠️ 같은 종류의 사고를 이미 겪었다 — 입금완료일자가 UTC 로 찍혀서
`Asia/Seoul` 을 강제로 넣었다 (`functions/index.js` 알림톡 트리거).
**서버·외부 API 는 UTC 가 기본이라고 생각하고 항상 확인할 것.**

## 4. 나중에 쓸 필드 (레코드에 이미 다 온다 — 총 90개)

오늘 늘린 검수 하자 항목과 그대로 이어진다. **1단계에서는 쓰지 않는다.**

| 검수 하자 항목 | M360 필드 |
|---|---|
| 유심 트레이 부재/손상 | `simTrayPresence` |
| 계정 잠김 (iCloud/Google) | `frpState` · `associatedAccount` · `brandAccounts` · `MDMState` |
| 분실·도난 신고 / 통신사 미납 잠김 | `blacklistCheckResult` · `simLockCheckResult` · `simLock` |
| 사설수리·비정품 부품 | `oemCheckResult` |
| 배터리 효율 저하/전원 불량 | `batteryHealthPercent`(예: `"100%"`) · `batteryCycles` · `fullChargeCapacity` |

그 밖에: `deviceColor` · `internalStorage` · `serial` · `brand` · `manufacturer` ·
`osType` · `softwareVersion` · `rooted` · `iosJailbreak` · `secureLocked` ·
`gradingResult` · `gradingPhotos` · `diagnosticsResults` · `deviceExpense`

⚠️ `batteryHealthPercent` 는 **`%` 가 붙은 문자열**이다. 숫자로 쓰려면 떼야 한다.

## 5. generateReport — 검수완료서 PDF (2단계)

```
POST /api/customer/v2/generateReport
```
"주어진 기기 세션에서 **PDF / HTML 보고서**를 만든다"

| 이름 | 설명 |
|---|---|
| `diagnosticsResultId` | 기본값은 그 세션의 마지막 진단 결과 |
| `contents` | 기본 전체. `diagnostics`/`grading`/`wipe`/`oem_check`/`device_expenses`/`grading_photos` |
| `dateTimeFormat` · `timeZone` | 표시 형식 |

→ 고객 마이페이지의 **「M360 검수완료서 / 첨부파일」** 이 이것이다 (`mypage.html` 2031줄).

## 6. M360 사용자 (2026-08-26 기준)

```
dda465            (사장님)
tngus2595.naver   ← 업무프로그램 검수 직원과 같은 이메일로 만들어 둠
jigeun45.naver    ← 같음
```

⚠️ **사용자명이 이메일에서 규칙적으로 만들어지지 않는다.**
   `tngus2595@naver.com` → `tngus2595.naver` 인데 `dda465@gmail.com` → `dda465` 다.
   **이메일에서 계산해내지 마라.** 직원 문서에 M360 사용자명을 따로 저장한다.

## 7. 아직 확인 못 한 것

- 라이브에서 `username` 에 실제로 무엇이 오는지 (테스트 모드는 `dda465` 로 고정돼 나옴)
- `meta` 안에 무엇이 있는지
- 호출 횟수 제한
- 오류 코드 — 문서에 `Error Codes` 항목이 따로 있다
