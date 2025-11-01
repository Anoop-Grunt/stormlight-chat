# 🧠 Prompts & LLM Usage Notes

> **Note:**  
> I used Large Language Models Gpt-5 mainly for **refactoring the UI** from a single `page.tsx` file into separate comoponents,
>  and to swith state management to `jotai`. I also used it to **create the `README.md` file.**
> For the workers, I only used Gpt to modify the payloads and the chat object format while adding the personas feature. I noticed that Gpt struggled to generate code using the
> edge-runtime APIs, so I had to write most of that myself.

### Prompt 0 - Adding persona's to llm-workflow payloads
At this point I just had a basic chat application running, and wanted to add separate personas. 

> Here's a cloudflare workflow that I'm triggering directly from the frontend when a new message is sent on a chatbox. Can you please add a new flag in the fetch payload to accept a string called "persona"?
> And also modify the run method to do the following --> if this is the first messge in that chat generate the system prompt like so using a template string --> "You are ${persona} from the Stormlight archive"
> And add a sentence or two to make the LLM respond in-character. Then in the KV object, make a field called persona and store this value, so I can retrieve it later, also move the current JSON array into a field called chat in the same object.

Once this was done, and the retrieve chat endpoint was returning the persona too, I added some theming on the UI based on this flag, just for visual flar.

### Prompt 2 - Refactoring state management into Jotai atoms

I gave the model the state management and useEffect logic from page.tsx, which handled real-time chat updates via the HTTP stream.  
Then I gave it this prompt:

> This full page.tsx re-renders when a new message is sent on the HTTP stream, so let's break this down into Jotai atoms--> Make write-only atoms for all the chat and debug messages so that I can import only the write-only atoms, to then import them into the page.tsx file. I basically want to only import the write-only atoms with the useSetAtom hook, cuz I don't want all these re-renders. Can you give me separate files for atoms/chatLog.ts and atoms/debugLog.ts?

---

### Prompt 3 - Import statements, and modifying chat and debug sections withing page.tsx

After creating the atom files, I asked the model to give me import statements. At this point, I asked it to include the base atoms as well, since the chat and debug cards weren't separate components yet:

> Give me the import statements for page.tsx to use these new atoms. For now still include the base atoms along with the write-only atoms, and modify both <Card> sections to render using these atoms.



### Prompt 4 - After making sure that the atoms were working as expected on the main page

Now, the atoms were working properly, but since they were imported on the main page, I was still having full re-renders. I asked it to now separate the cards into components
> Okay, that works fine, so give me the following -->  move the two cards into separate components, and move all the import statements for the base atoms there. Leave the write-only atoms in page.tsx, since I'll just have the httpStream listener be global. Also, import all the Shadcn components you need into these separate components, i'll remove them from page.tsx

### Prompt 5 - Mermaid chart for `README.md`

I wanted a mermaid chart to explain the arrchitecture on the `README.md` file. I first pasted all the workers one-by-one, and used this prompt

> Can you give me a mermaid sequence diagram to put on the README filee? btw the UI is deployed on cloudflare pages as a static site. Just make sure to show the full network waterfall and the chat message http streaming workflow loop on the mermaid chart


### Prompt 6 - Components table for `README.md`

I asked the model to create a new table with links to the docs for each of the services I used.

> Can you give me a markdown table showing all the components that I used in this architecture? Please be sure to include links to the actual cloudflare docs, and also include a one-liner explanation for each of these


### Prompt 7 - Project structure file tree  for `README.md`

I ran `ls -R --max-depth=4 --hide='.git' --hide='.gitignore' --hide='node_modules'` to list all the project files, excluding git and node_modules. Then I copied the terminal buffer, and asked for a file-tree representation

> Can you look at this file structure and give me a markdown friendly file-tree view? Also for the workers, have a small one-liner description next to the `worker.ts` node
 `
