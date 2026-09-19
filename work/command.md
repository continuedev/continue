# Continue フォーク後 運用・便利コマンド集

本ドキュメントは、`continuedev/continue` をフォークした後の日常的な開発・運用で使用する便利コマンドをまとめたチートシートです。

---

## 1. リモート設定の確認と構成

フォーク環境では、リモートが以下のように設定されています。

- **`origin`**: あなたのフォークリポジトリ (`https://github.com/S-Komatsuda-Yaku/continue.git`)
- **`upstream`**: 本家リポジトリ (`https://github.com/continuedev/continue.git`)

### 設定確認
```bash
git remote -v
```

---

## 2. 日常の開発フロー

### 2.1 ブランチの作成と切り替え
特定のタグ（例: `v2.0.0-vscode`）や既存ブランチから新しい機能ブランチを作成する場合:

```bash
# v2.0.0-vscode タグから新規ブランチを作成
git checkout -b feature/my-continue-ext tags/v2.0.0-vscode

# 既存ブランチから新規ブランチを作成
git checkout -b feature/new-extension-feature
```

### 2.2 変更の確認・コミット・プッシュ
```bash
# 変更状態の確認
git status

# 変更差分の確認
git diff

# 変更をステージングしてコミット
git add .
git commit -m "feat: Continue拡張機能のカスタム設定を追加"

# 自分のフォークリポジトリ (origin) にプッシュ
git push -u origin feature/my-continue-ext
```

---

## 3. 本家 (upstream) の更新を取り込む

### 3.1 本家の最新情報を取得
```bash
git fetch upstream
```

### 3.2 本家のタグ一覧・ブランチ確認
```bash
# 本家のタグ一覧を確認
git tag -l "v*" | sort -V | tail -n 20

# 本家の最新mainをマージ
git merge upstream/main
```

---

## 4. ビルド・拡張機能パッケージング

```bash
# 依存関係のインストール
npm install

# VS Code 拡張機能パッケージのビルド
cd extensions/vscode
npm run package
```
