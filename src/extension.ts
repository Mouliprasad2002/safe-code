import * as vscode from 'vscode';

// Sensitive patterns list (expandable)
const sensitivePatterns: RegExp[] = [
    /\b(password|passwd|secret|apiKey|token|auth|credential|key)\b/gi,   // common keywords
    /['"`][^'"`]{3,}password[^'"`]{0,}['"`]/gi,                        // anything like "mypassword"
    /\b\d{4,}\b/g,                                                     // numbers 4+ digits (possible PINs/IDs)
    /(?:[A-Za-z0-9]{20,})/g,                                           // long alphanumeric (possible tokens)
    /[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/g                                    // emails
];

export function activate(context: vscode.ExtensionContext) {
    console.log('Safe Code extension is active.');

    // Status bar item: first position, high priority
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200); 
    statusBarItem.command = "safeCode.showViolations";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    let violations: { word: string, position: vscode.Position }[] = [];

    // Update status bar
    function updateStatus(document: vscode.TextDocument) {
        violations = [];
        const text = document.getText();

        sensitivePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const position = document.positionAt(match.index);
                violations.push({ word: match[0], position });
            }
        });

        const count = violations.length;
        if (count > 0) {
            statusBarItem.text = `🔴 ${count} (Sensitive words)`; // red dot + count
            statusBarItem.color = "#FF0000"; // bright red
        } else {
            statusBarItem.text = `🟢 0 (Sensitive words)`; // green dot + 0
            statusBarItem.color = "#00FF00"; // bright green
        }
        statusBarItem.show();
    }

    // Trigger on editor events
    if (vscode.window.activeTextEditor) {
        updateStatus(vscode.window.activeTextEditor.document);
    }
    vscode.workspace.onDidOpenTextDocument(doc => updateStatus(doc), null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument(e => updateStatus(e.document), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updateStatus(editor.document);
    }, null, context.subscriptions);

    // Command to show violations
    const showViolations = vscode.commands.registerCommand("safeCode.showViolations", async () => {
        if (violations.length === 0) {
            vscode.window.showInformationMessage("No sensitive words found ✅");
            return;
        }

        const items = violations.map(v => ({
            label: `⚠️ ${v.word}`,
            description: `Line ${v.position.line + 1}, Col ${v.position.character + 1}`,
            position: v.position
        }));

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: "Sensitive words found in this file"
        });

        if (selection) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const range = new vscode.Range(selection.position, selection.position.translate(0, selection.label.length));
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            }
        }
    });
    context.subscriptions.push(showViolations);
}

export function deactivate() {}
