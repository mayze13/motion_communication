MINDS IN MOTION — Shared Assets
================================

Drop your image files into the folders below. The website, flyer, and email
template all reference these paths, so adding a file here makes it appear
everywhere automatically.


images/
  ucl-logo-white.png
      The UCL logo in white, for use on the purple (#361a54) header background.
      Recommended format: PNG with transparent background.
      Recommended height: 40-60px tall (width proportional).

  ucl-logo-purple.png
      The UCL logo in UCL purple, for use on light/white backgrounds (e.g. email
      footer on a white background, flyer footer).

  banner.jpg
      The main study hero image, shown at the top of the website and in the email
      template. Recommended dimensions: at least 1200 x 500px, landscape.
      JPEG or PNG accepted.

  people/
      One headshot per team member. Name the files exactly as shown below,
      or update the corresponding <img src="..."> in website/index.html.

      hugo-spiers.jpg      Prof. Hugo Spiers
      fiona-zisch.jpg      Dr Fiona Zisch
      sean-hanna.jpg       Prof. Sean Hanna
      daniel-tang.jpg      Daniel Tang
      james-moultrie.jpg   James Moultrie

      Recommended: square crop, at least 200x200px.
      If a file is missing the page shows the person's initials instead.


HOW THE WEBSITE REFERENCES THESE FILES
---------------------------------------
The website lives in the website/ folder, so paths go one level up:
  ../assets/images/banner.jpg
  ../assets/images/ucl-logo-white.png
  ../assets/images/people/hugo-spiers.jpg

The flyer lives in flyer/ so it uses the same relative path pattern.
The email template uses full hosted URLs (email clients cannot load local files).
