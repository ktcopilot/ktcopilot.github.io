/**
 * Taxonomy filtering functionality
 * Shows only posts matching the clicked taxonomy (category or tag)
 */
document.addEventListener('DOMContentLoaded', function() {
  // Get all taxonomy items in the index list
  const taxonomyLinks = document.querySelectorAll('.taxonomy__index a');
  
  // Create a "Show All" button that will be placed below the title
  const showAllButton = document.createElement('button');
  showAllButton.id = 'show-all-button';
  showAllButton.className = 'btn btn--primary';
  showAllButton.textContent = '전체 보기';
  showAllButton.style.display = 'none';
  showAllButton.style.marginBottom = '1em';
  
  // Add the Show All button below the page title
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    // Insert button after the title
    pageTitle.parentNode.insertBefore(showAllButton, pageTitle.nextSibling);
    // Don't change the layout to flex
  }
  
  // Add click event listener to Show All button
  showAllButton.addEventListener('click', function() {
    // Show all sections
    const allSections = document.querySelectorAll('.taxonomy__section');
    allSections.forEach(section => {
      section.style.display = 'block';
    });
    
    // Remove active class from all taxonomy links
    taxonomyLinks.forEach(link => {
      link.classList.remove('active');
      link.parentElement.classList.remove('active');
    });
    
    // Hide the Show All button
    showAllButton.style.display = 'none';
    
    // Add a message that all items are now visible
    const message = document.createElement('div');
    message.className = 'notice notice--success';
    message.textContent = '모든 항목을 표시합니다';
    message.id = 'filter-message';
    message.style.padding = '0.5em 1em';
    message.style.marginBottom = '1em';
    message.style.marginTop = '0.5em';
    
    // Remove any existing message
    const existingMessage = document.getElementById('filter-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Add the message below the title
    if (pageTitle) {
      pageTitle.parentNode.insertBefore(message, showAllButton.nextSibling);
      
      // Auto-remove message after 3 seconds
      setTimeout(function() {
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        setTimeout(function() {
          message.remove();
        }, 500);
      }, 3000);
    }
  });
  
  // Add click event listener to each taxonomy link
  taxonomyLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      // Let the default anchor behavior happen to scroll to the section
      
      // After the browser has had time to scroll, handle the filtering
      setTimeout(function() {
        // Get the taxonomy ID from the link's href
        const taxonomyId = link.getAttribute('href').substring(1); // Remove the # character
        
        // Hide all taxonomy sections
        const allSections = document.querySelectorAll('.taxonomy__section');
        allSections.forEach(section => {
          section.style.display = 'none';
        });
        
        // Show only the selected section
        const selectedSection = document.getElementById(taxonomyId);
        if (selectedSection) {
          selectedSection.style.display = 'block';
        }
        
        // Remove active class from all links and add to the clicked one
        taxonomyLinks.forEach(l => {
          l.classList.remove('active');
          l.parentElement.classList.remove('active');
        });
        link.classList.add('active');
        link.parentElement.classList.add('active');
        
        // Show the Show All button
        showAllButton.style.display = 'block';
        
        // Add a message indicating which filter is active
        const message = document.createElement('div');
        message.className = 'notice notice--info';
        message.textContent = '표시 항목: ' + selectedSection.querySelector('h2').textContent;
        message.id = 'filter-message';
        message.style.padding = '0.5em 1em';
        message.style.marginBottom = '1em';
        message.style.marginTop = '0.5em';
        
        // Remove any existing message
        const existingMessage = document.getElementById('filter-message');
        if (existingMessage) {
          existingMessage.remove();
        }
        
        // Add the message below the title and the show all button
        if (pageTitle) {
          pageTitle.parentNode.insertBefore(message, showAllButton.nextSibling);
        }
      }, 100); // Small delay to allow browser to scroll
    });
  });
}); 