# backend/poly_service.py
import logging
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PolyCoder Documentation Generator")

# -------------------------
# Load PolyCoder model
# -------------------------
MODEL_NAME = "NinedayWang/PolyCoder-160M"  # smaller for MVP
logger.info("Loading tokenizer & model …")
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME, torch_dtype=torch.float32)
except Exception as e:
    logger.error(f"Failed to load model/tokenizer: {e}")
    raise

# Set pad token if missing
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
    logger.info(f"Pad token set to EOS token ({tokenizer.eos_token_id})")

# -------------------------
# Request schema
# -------------------------
class CodeInput(BaseModel):
    code: str

# -------------------------
# Helper: Clean input code
# -------------------------
def clean_code(code: str) -> str:
    """Remove license headers, copyright, empty lines."""
    try:
        code = re.sub(r"/\*[\s\S]*?Licensed[\s\S]*?\*/", "", code)
        lines = [
            line for line in code.split("\n")
            if line.strip() and not re.search(r"(license|copyright)", line, re.I)
        ]
        return "\n".join(lines).strip()
    except Exception as e:
        logger.warning(f"Error cleaning code: {e}")
        return code.strip()

# -------------------------
# Helper: Filter model output
# -------------------------
def filter_output(output: str) -> str:
    """Remove unwanted lines like license, headers, or annotations."""
    try:
        lines = output.split("\n")
        filtered = [line for line in lines if not re.search(r"(license|@|import|using)", line, re.I)]
        # Remove the original prompt if repeated
        filtered = [line for line in filtered if "### Summary" not in line and line.strip()]
        return "\n".join(filtered).strip()
    except Exception as e:
        logger.warning(f"Error filtering output: {e}")
        return output.strip()

# -------------------------
# API endpoint: Generate technical summary
# -------------------------
@app.post("/generate")
async def generate_doc(req: CodeInput):
    try:
        code = clean_code(req.code)
        if not code:
            return {"technical": "Empty code after cleaning."}

        prompt = (
            f"Summarize the structure and core logic of this code in short bullet points.\n"
            f"Do NOT return the full code, only the logic.\n"
            f"Code:\n{code}\n### Summary:\n"
        )

        # Tokenize input
        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding="max_length"
        )

        input_ids = inputs.input_ids
        attention_mask = inputs.attention_mask

        # Generate summary safely
        outputs = model.generate(
            input_ids,
            attention_mask=attention_mask,
            max_new_tokens=150,
            num_beams=3,
            early_stopping=True,
            pad_token_id=tokenizer.pad_token_id
        )

        summary = tokenizer.decode(outputs[0], skip_special_tokens=True)
        summary = filter_output(summary)

        if not summary:
            summary = "PolyCoder did not generate a readable summary."

        return {"technical": summary}

    except RuntimeError as e:
        logger.error(f"Runtime error during generation: {e}")
        return {"technical": "Error: model failed to generate summary. Try a smaller input."}
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {"technical": f"Unexpected error: {str(e)}"}

# -------------------------
# Root endpoint
# -------------------------
@app.get("/")
def home():
    return {"message": "PolyCoder Documentation API running."}
