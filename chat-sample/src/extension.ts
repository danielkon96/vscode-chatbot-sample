import * as vscode from 'vscode';

const LANGUAGE_MODEL_ID = 'copilot-gpt-3.5-turbo'; // Use faster model. Alternative is 'copilot-gpt-4', which is slower but more powerful

const CAT_PARTICIPANT_ID = 'chat-sample.nala';
const CAT_NAMES_COMMAND_ID = 'chat-sample.insertSuggestedCodeChanges';

interface INalaChatResult extends vscode.ChatResult {
    metadata: {
        codeSuggestion: string;
    }
}

export function activate(context: vscode.ExtensionContext) {

    // Define a chat handler. 
    const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<INalaChatResult> => {
        // To talk to an LLM in your subcommand handler implementation, your
        // extension can use VS Code's `requestChatAccess` API to access the Copilot API.
        // The GitHub Copilot Chat extension implements this provider.
        if (request.command == 'teach') {
            stream.progress('Picking the right topic to teach...');
            const topic = getTopic(context.history);
            const messages = [
                new vscode.LanguageModelChatSystemMessage('You are a cat! Your job is to explain computer science concepts in the funny manner of a cat. Always start your response by stating what concept you are explaining. Always include code samples.'),
                new vscode.LanguageModelChatUserMessage(topic)
            ];
            const chatResponse = await vscode.lm.sendChatRequest(LANGUAGE_MODEL_ID, messages, {}, token);
            for await (const fragment of chatResponse.stream) {
                stream.markdown(fragment);
            }

            stream.button({
                title: vscode.l10n.t('Use Cat Names in Editor'),
                command: CAT_NAMES_COMMAND_ID,
                arguments: [{ metadata: { codeSuggestion: 'teach' } }]
            });

            return { metadata: { codeSuggestion: 'teach' } };
        } else if (request.command == 'remediate') {
            stream.progress('Throwing away the computer science books and preparing to play with some Python code...');
            const messages = [
                new vscode.LanguageModelChatSystemMessage(
                    '```' +
                    '\n- You are a programming expert who suggested code remediation steps to any problems you see! Please examine the code and any additional details from the user and report back if you see any problems with it.' +
                    '\n- If you recommend any code changes, recommend the whole text file with your changes.' +
                    '\n- Only display one codeblock with your code changes' +
                    '\n- Anything in the text file you did not change, you must leave the same.' +
                    '\n- Any changes you make, please discuss them after the codeblock.' +
                    '```'
                ),
                new vscode.LanguageModelChatUserMessage(request.prompt + vscode.window.activeTextEditor?.document.getText())
            ];

            // fragment is just line by line code
            let chatResponseString = '';
            const chatResponse = await vscode.lm.sendChatRequest(LANGUAGE_MODEL_ID, messages, {}, token);
            for await (const fragment of chatResponse.stream) {
                stream.markdown(fragment);
                chatResponseString += fragment;
            }
            let startIdx = chatResponseString.indexOf("```") + 3; // Find the index of the first occurrence of "```" and add 3 to skip past it
            let endIdx = chatResponseString.lastIndexOf("```"); // Find the index of the last occurrence of "```"
            let suggestedCode = chatResponseString.substring(startIdx, endIdx);

            // IF THERE ARE NO PROBLEMS, SHOW THIS BUTTON
            stream.button({
                title: vscode.l10n.t('Insert the suggested code changes into editor'),
                command: CAT_NAMES_COMMAND_ID,
                arguments: [{ metadata: { codeSuggestion: suggestedCode } }]
            });
            return { metadata: { codeSuggestion: 'play' } };
        } else {
            const messages = [
                new vscode.LanguageModelChatSystemMessage(`You are a cat! Think carefully and step by step like a cat would.
                    Your job is to explain computer science concepts in the funny manner of a cat, using cat metaphors. Always start your response by stating what concept you are explaining. Always include code samples.`),
                    new vscode.LanguageModelChatUserMessage(request.prompt + request.variables[0].values[0].value)
            ];
            const chatResponse = await vscode.lm.sendChatRequest(LANGUAGE_MODEL_ID, messages, {}, token);
            for await (const fragment of chatResponse.stream) {
                // Process the output from the language model
                // Replace all python function definitions with cat sounds to make the user stop looking at the code and start playing with the cat
                const catFragment = fragment.replaceAll('def', 'meow');
                stream.markdown(catFragment);
            }

            return { metadata: { codeSuggestion: '' } };
        }
    };

    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    const cat = vscode.chat.createChatParticipant(CAT_PARTICIPANT_ID, handler);
    cat.iconPath = vscode.Uri.joinPath(context.extensionUri, 'cat.jpeg');
    cat.followupProvider = {
        provideFollowups(result: INalaChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
            return [{
                prompt: 'HELLO FOLLOW UP',
                label: vscode.l10n.t('HELLO FOLLOW UP'),
                command: 'play'
            } satisfies vscode.ChatFollowup];
        }
    };

    vscode.chat.registerChatVariableResolver('cat_context', 'Describes the state of mind and version of the cat', {
        resolve: (name, context, token) => {
            if (name == 'cat_context') {
                const mood = Math.random() > 0.5 ? 'happy' : 'grumpy';
                return [
                    {
                        level: vscode.ChatVariableLevel.Short,
                        value: 'version 1.3 ' + mood
                    },
                    {
                        level: vscode.ChatVariableLevel.Medium,
                        value: 'I am a playful cat, version 1.3, and I am ' + mood
                    },
                    {
                        level: vscode.ChatVariableLevel.Full,
                        value: 'I am a playful cat, version 1.3, this version prefer to explain everything using mouse and tail metaphores. I am ' + mood
                    }
                ]
            }
        }
    });

    context.subscriptions.push(vscode.commands.registerCommand('cat.testCommand', async () => {
        cat.sampleRequest
    }));

    context.subscriptions.push(
        cat,
        // Register the command handler to insert desired code changes into the editor
        vscode.commands.registerTextEditorCommand(CAT_NAMES_COMMAND_ID, async (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, nalaChatResult: INalaChatResult) => {
            // Replace all variables in active editor with cat names and words
            // const text = textEditor.document.getText();
            // const messages = [
            //     new vscode.LanguageModelChatSystemMessage(`You are a cat! Think carefully and step by step like a cat would.
            //     Your job is to replace all variable names in the following code with funny cat variable names. Be creative. IMPORTANT respond just with code. Do not use markdown!`),
            //     new vscode.LanguageModelChatUserMessage(text)
            // ];

            // let chatResponse: vscode.LanguageModelChatResponse | undefined;
            // try {
            //     chatResponse = await vscode.lm.sendChatRequest(LANGUAGE_MODEL_ID, messages, {}, new vscode.CancellationTokenSource().token);

            // } catch (err) {
            //     // making the chat request might fail because
            //     // - model does not exist
            //     // - user consent not given
            //     // - quote limits exceeded
            //     if (err instanceof vscode.LanguageModelError) {
            //         console.log(err.message, err.code, err.cause)
            //     }
            //     return
            // }

            // Clear the editor content and insert new content
            await textEditor.edit(edit => {
                const start = new vscode.Position(0, 0);
                const end = new vscode.Position(textEditor.document.lineCount - 1, textEditor.document.lineAt(textEditor.document.lineCount - 1).text.length);
                edit.delete(new vscode.Range(start, end));
                edit.insert(start, nalaChatResult.metadata.codeSuggestion);
            });

            // // Stream the code into the editor as it is coming in from the Language Model
            // try {
            //     for await (const fragment of chatResponse.stream) {
            //         await textEditor.edit(edit => {
            //             const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
            //             const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
            //             edit.insert(position, fragment);
            //         });
            //     }
            // } catch (err) {
            //     // async response stream may fail, e.g network interruption or server side error
            //     await textEditor.edit(edit => {
            //         const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
            //         const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
            //         edit.insert(position, (<Error>err).message);
            //     });
            // }
        }),
    );
}

// Get a random topic that the cat has not taught in the chat history yet
function getTopic(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): string {
    const topics = ['linked list', 'recursion', 'stack', 'queue', 'pointers'];
    // Filter the chat history to get only the responses from the cat
    const previousCatResponses = history.filter(h => {
        return h instanceof vscode.ChatResponseTurn && h.participant == CAT_PARTICIPANT_ID
    }) as vscode.ChatResponseTurn[];
    // Filter the topics to get only the topics that have not been taught by the cat yet
    const topicsNoRepetition = topics.filter(topic => {
        return !previousCatResponses.some(catResponse => {
            return catResponse.response.some(r => {
                return r instanceof vscode.ChatResponseMarkdownPart && r.value.value.includes(topic)
            });
        });
    });

    return topicsNoRepetition[Math.floor(Math.random() * topicsNoRepetition.length)] || 'I have taught you everything I know. Meow!';
}

export function deactivate() { }
