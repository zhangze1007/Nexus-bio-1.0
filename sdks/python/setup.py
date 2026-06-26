"""Setup script for the Nexus-Bio Python SDK."""

from setuptools import setup, find_packages

setup(
    name="nexus-bio",
    version="0.1.0",
    description="Python SDK for the Nexus-Bio synthetic biology AI platform",
    author="Zhang Ze Foo",
    author_email="fuchanze@gmail.com",
    url="https://github.com/zhangze1007/Nexus-bio-1.0",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "httpx>=0.27,<1",
        "pydantic>=2.0,<3",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0",
            "pytest-httpx>=0.30",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Bio-Informatics",
    ],
)
