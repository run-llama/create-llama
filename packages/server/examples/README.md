# LlamaIndex Server Examples

This directory provides example projects demonstrating how to use the LlamaIndex Server.

## How to Run the Examples

1. **Install dependencies**

   In the root of this directory, run:

   ```bash
   pnpm install
   ```

2. **Set your OpenAI API key**

   Export your OpenAI API key as an environment variable:

   ```bash
   export OPENAI_API_KEY=your_openai_api_key
   ```

3. **Start an example**

   Replace `<example>` with the name of the example you want to run (e.g., `private-file`):

   ```bash
   pnpm nodemon --exec tsx <example>/index.ts
   ```

4. **Open the application in your browser**

   Visit [http://localhost:3000](http://localhost:3000) to interact with the running example.

## Notes

- Make sure you have [pnpm](https://pnpm.io/) installed.
- Each example may have its own specific instructions or requirements; check the individual example's index.ts for details.
