"""
Sample Summarizer Tool (Python)
Used for testing Python tool loading

@tool summarizer
@description Summarizes text to a shorter version
@param text string The text to summarize  
@param max_length number Maximum length of summary (default: 100)
@returns string The summarized text
"""

def summarizer(text: str, max_length: int = 100) -> str:
    """Summarize text to the specified maximum length."""
    if len(text) <= max_length:
        return text
    
    # Simple truncation with ellipsis
    return text[:max_length - 3] + '...'

if __name__ == '__main__':
    # Test the function
    sample = "This is a very long text that needs to be summarized."
    print(summarizer(sample, 30))
