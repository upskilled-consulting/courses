import csv
import os
import sys
import anthropic

SYSTEM_PROMPT = """You are a research-paper analyst. Your task is to rewrite a paper's abstract using the "Annotated Abstract" framework, which breaks the text into eight clearly-labelled rhetorical moves:

1. **Topic** – the subject area or object of study (1-2 sentences)
2. **Motivation** – the gap, problem, or open question that makes the work necessary (1-2 sentences)
3. **Contribution** – the core claim or method introduced ("In this work, we …") (1-2 sentences)
4. **Detail / Nuance** – specifics, conditions, or caveats of the contribution (1-3 sentences)
5. **Evidence / Contribution 2** – supporting results or a second distinct contribution (1-2 sentences)
6. **Weaker result** – a secondary or more qualified finding (1 sentence)
7. **Narrow impact** – the direct, specific implication for the field (1 sentence)
8. **Broad impact** – the wider takeaway or vision (1 sentence)

Rules:
- Use only information present in the provided paper text. Do not invent results.
- Each section should be a tight paragraph (no bullet sub-lists inside sections).
- Output ONLY the eight labelled sections in markdown.
- Do not include any preamble, title, or commentary outside the eight sections."""

def main():
    # Read the CSV and get the first row's markdown_content
    with open(r"C:\Users\nicho\Desktop\upskilled-platform\3dgs-paper-markdown.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        first_row = next(reader)

    markdown_content = first_row["markdown_content"]
    # Pass the first 40000 characters as specified
    user_message = markdown_content[:40000]

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key and len(sys.argv) > 1:
        api_key = sys.argv[1]
    client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()

    # Use streaming as the content is large and output may be lengthy
    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)

    print()  # final newline

if __name__ == "__main__":
    main()
