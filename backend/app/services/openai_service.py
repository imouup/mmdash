import json
import openai
from app.core.config import get_settings

settings = get_settings()
openai_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None


async def analyze_symbols(markdown_text: str) -> list:
    """Extract symbols and their meanings from model document."""
    if not openai_client:
        return []
    prompt = f"""Analyze the following mathematical modeling document and extract all mathematical symbols used.
For each symbol, provide:
1. The symbol itself
2. Its meaning/context in the model
3. Whether it appears to be user-defined or standard notation

Return as a JSON array of objects with fields: symbol, meaning, source("user" or "inferred").

Document:
{markdown_text[:4000]}
"""
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        content = resp.choices[0].message.content
        data = json.loads(content)
        return data.get("symbols", [])
    except Exception:
        return []


async def analyze_structure(markdown_text: str) -> dict:
    """Analyze overall structure of the model document."""
    if not openai_client:
        return {}
    prompt = f"""Analyze the structure of the following mathematical modeling document.
Provide:
1. A brief overall summary
2. Key sections identified
3. How the model relates to the problem statement

Return as JSON with fields: summary, sections(array), problem_relationship.

Document:
{markdown_text[:4000]}
"""
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        content = resp.choices[0].message.content
        return json.loads(content)
    except Exception:
        return {}


async def explain_formula(formula: str, context: str = "") -> str:
    """Explain a mathematical formula in plain language."""
    if not openai_client:
        return "LLM service not configured."
    prompt = f"""Explain the following mathematical formula in detail, breaking down each term and its meaning.

Formula: {formula}
Context: {context}

Provide a clear, educational explanation suitable for a math modeling team member.
"""
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return resp.choices[0].message.content
    except Exception as e:
        return f"Explanation failed: {str(e)}"


async def find_errors(markdown_text: str) -> list:
    """Find logical errors and typos in the model document."""
    if not openai_client:
        return []
    prompt = f"""Review the following mathematical modeling document for potential errors.
Look for:
1. Mathematical typos or inconsistent notation
2. Logical inconsistencies in the model assumptions
3. Missing constraints or boundary conditions
4. Formula errors or dimension mismatches

For each issue found, provide:
- The relevant text/excerpt
- A description of the potential error
- A severity level: "warning" or "error"

Return as a JSON array of objects with fields: excerpt, description, severity.
If no issues are found, return an empty array.

Document:
{markdown_text[:4000]}
"""
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        content = resp.choices[0].message.content
        data = json.loads(content)
        return data.get("errors", [])
    except Exception:
        return []
